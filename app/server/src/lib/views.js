// Derived views over syncEvents (Backend schema doc, "Derived views"). Order stage, open issues and
// counts are computed on read, so nothing is stored beyond the append-only event log.
import {
  WORKFLOW_A, WORKFLOW_B, WORKFLOW_LABELS, STEPS, systemForStep, reasonFor,
} from './vocab.js';

// Events from one flow run all carry that run's timestamp, so time alone leaves their order to insertion
// order, and a flow that lists newest-first would put the oldest order on top. A larger order number is a
// later order, so ties break newest order first. The key is numeric ("999" must not outrank "1004"),
// taken from the order number and falling back to the order id when there is no usable number.
const orderKeyOf = (numberField, idField) => ({
  $convert: {
    input: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: [numberField, ''] } }, 0] }, numberField, idField] },
    to: 'double', onError: 0, onNull: 0,
  },
});

// Base step: the latest success-or-failure per (order, workflow). Skipped events are excluded so a
// skip can never create an order or close an issue.
export const latestPerOrderWorkflow = (customerId, extraMatch = {}) => [
  { $match: { customerId, outcome: { $in: ['success', 'failed'] }, ...extraMatch } },
  { $sort: { at: -1, _id: -1 } },
  { $group: {
    _id: { orderId: '$orderId', workflow: '$workflow' },
    eventId: { $first: '$eventId' },
    outcome: { $first: '$outcome' },
    step: { $first: '$step' },
    errorKind: { $first: '$errorKind' },
    error: { $first: '$error' },
    at: { $first: '$at' },
    orderNumber: { $max: '$orderNumber' },
    everSucceeded: { $max: { $eq: ['$outcome', 'success'] } },
  } },
];

// Open issue: the latest event for a (customer, order, workflow) is a failure.
export const openIssuesPipeline = (customerId, extraMatch = {}) => [
  ...latestPerOrderWorkflow(customerId, extraMatch),
  { $match: { outcome: 'failed' } },
  { $addFields: { orderKey: orderKeyOf('$orderNumber', '$_id.orderId') } },
  { $sort: { at: -1, orderKey: -1 } },
];

export const ordersPipeline = (customerId, { limit } = {}) => [
  ...latestPerOrderWorkflow(customerId),
  { $group: {
    _id: '$_id.orderId',
    orderNumber: { $max: '$orderNumber' },
    lastEventAt: { $max: '$at' },
    needsAttention: { $max: { $eq: ['$outcome', 'failed'] } },
    shipped: { $max: { $and: [{ $eq: ['$_id.workflow', WORKFLOW_B] }, '$everSucceeded'] } },
  } },
  { $addFields: { stage: { $switch: {
    branches: [
      { case: '$needsAttention', then: 'needs_attention' },
      { case: '$shipped', then: 'shipped' },
    ],
    default: 'waiting',
  } } } },
  { $addFields: { orderKey: orderKeyOf('$orderNumber', '$_id') } },
  { $sort: { lastEventAt: -1, orderKey: -1 } },
  ...(limit ? [{ $limit: limit }] : []),
];

// Failed counts distinct (order, workflow) pairs: a flow can report a failure on every retry attempt,
// so counting events would show one broken order as three failures.
export const countsPipeline = (customerId, since) => [
  { $match: { customerId, at: { $gte: since } } },
  { $facet: {
    byOutcome: [
      { $match: { outcome: { $in: ['success', 'skipped'] } } },
      { $group: { _id: '$outcome', n: { $sum: 1 } } },
    ],
    failed: [
      { $match: { outcome: 'failed' } },
      { $group: { _id: { o: '$orderId', w: '$workflow' } } },
      { $count: 'n' },
    ],
  } },
];

const distinctOrdersPipeline = (customerId, workflow, since) => [
  { $match: { customerId, workflow, outcome: 'success', at: { $gte: since } } },
  { $group: { _id: '$orderId' } },
  { $count: 'n' },
];

// Midnight in the merchant's timezone, as a UTC Date. Computed in Node before the query.
export function startOfLocalDay(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const wallClockAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  const offsetMs = wallClockAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day')) - offsetMs);
}

const pairKey = (orderId, workflow) => `${orderId}|${workflow}`;

// Every failed attempt of a still-broken (order, workflow) pair is open, not just the latest one: the
// alert email deep-links to the first attempt, and later retries must not make it read "resolved".
export const openPairs = (issues) => new Set(issues.map((i) => pairKey(i._id.orderId, i._id.workflow)));

// One event in the shape every browser endpoint returns.
export function toFeedEvent(doc, open) {
  const orderId = doc.orderId ?? doc._id?.orderId;
  const workflow = doc.workflow ?? doc._id?.workflow;
  const system = doc.outcome === 'failed' ? systemForStep(doc.step) : null;
  return {
    eventId: doc.eventId,
    orderId,
    orderNumber: doc.orderNumber ?? null,
    workflow,
    label: WORKFLOW_LABELS[workflow],
    outcome: doc.outcome,
    step: doc.step,
    stepLabel: STEPS[doc.step]?.label ?? doc.step,
    system,
    errorKind: doc.errorKind ?? null,
    reason: reasonFor(doc),
    error: doc.error ?? null,
    at: doc.at,
    open: doc.outcome === 'failed' && open.has(pairKey(orderId, workflow)),
  };
}

export async function getOpenIssues(db, customerId, extraMatch) {
  return db.collection('syncEvents').aggregate(openIssuesPipeline(customerId, extraMatch)).toArray();
}

export async function getCounts(db, customerId, since) {
  const [res] = await db.collection('syncEvents').aggregate(countsPipeline(customerId, since)).toArray();
  const by = Object.fromEntries(res.byOutcome.map((r) => [r._id, r.n]));
  return { synced: by.success ?? 0, skipped: by.skipped ?? 0, failed: res.failed[0]?.n ?? 0 };
}

// Sync health feed: the union of open issues and the latest `limit` events, de-duplicated by eventId,
// open issues first, then newest first, cut to `limit`. A requested `event` is always included.
export async function getFeed(db, customerId, { issuesOnly, event, limit, sinceHours }, now = new Date()) {
  const since = new Date(now.getTime() - sinceHours * 3600 * 1000);
  const [issues, counts] = await Promise.all([
    getOpenIssues(db, customerId),
    getCounts(db, customerId, since),
  ]);
  const open = openPairs(issues);

  let docs = issues;
  if (!issuesOnly) {
    const recent = await db.collection('syncEvents').aggregate([
      { $match: { customerId } },
      { $addFields: { orderKey: orderKeyOf('$orderNumber', '$orderId') } },
      { $sort: { at: -1, orderKey: -1, _id: -1 } },
      { $limit: limit },
    ]).toArray();
    docs = [...issues, ...recent];
  }
  const seen = new Set();
  let events = docs
    .filter((d) => (seen.has(d.eventId) ? false : seen.add(d.eventId)))
    .slice(0, limit)
    .map((d) => toFeedEvent(d, open));

  if (event && !events.some((e) => e.eventId === event)) {
    const doc = await db.collection('syncEvents').findOne({ customerId, eventId: event });
    if (doc) events = [toFeedEvent(doc, open), ...events].slice(0, limit);
  }

  return { counts: { ...counts, sinceHours }, openIssueCount: issues.length, events };
}

export async function getOrders(db, customerId, stage) {
  const all = await db.collection('syncEvents').aggregate(ordersPipeline(customerId)).toArray();
  return all
    .filter((o) => !stage || o.stage === stage)
    .slice(0, 100)
    .map((o) => ({ orderId: o._id, orderNumber: o.orderNumber ?? null, stage: o.stage, lastEventAt: o.lastEventAt }));
}

export async function getOrderDetail(db, customerId, orderId) {
  const [header] = (await db.collection('syncEvents')
    .aggregate([{ $match: { orderId } }, ...ordersPipeline(customerId)]).toArray());
  const timelineDocs = await db.collection('syncEvents')
    .find({ customerId, orderId }).sort({ at: 1, _id: 1 }).toArray();
  if (!header && !timelineDocs.length) return null;
  const issues = await getOpenIssues(db, customerId, { orderId });
  const open = openPairs(issues);
  return {
    orderId,
    orderNumber: header?.orderNumber ?? timelineDocs.find((d) => d.orderNumber)?.orderNumber ?? null,
    stage: header?.stage ?? null,
    lastEventAt: header?.lastEventAt ?? timelineDocs.at(-1)?.at ?? null,
    timeline: timelineDocs.map((d) => toFeedEvent(d, open)),
  };
}

export async function getTodayCounts(db, customer, now = new Date()) {
  const midnight = startOfLocalDay(customer.timezone, now);
  const coll = db.collection('syncEvents');
  const id = customer.fastnEndOrgId;
  const [received, shipped, orders] = await Promise.all([
    coll.aggregate(distinctOrdersPipeline(id, WORKFLOW_A, midnight)).toArray(),
    coll.aggregate(distinctOrdersPipeline(id, WORKFLOW_B, midnight)).toArray(),
    coll.aggregate(ordersPipeline(id)).toArray(),
  ]);
  return {
    received: received[0]?.n ?? 0,
    waiting: orders.filter((o) => o.stage === 'waiting').length,
    shipped: shipped[0]?.n ?? 0,
  };
}

// Only new and connecting are stored; everything else derives from open issues.
export function workspaceState(customer, issues) {
  if (customer.status === 'new') return { state: 'new', reconnectSystem: null };
  if (customer.status === 'connecting') return { state: 'connecting', reconnectSystem: null };
  const conn = issues.find((i) => i.errorKind === 'connection');
  if (conn) return { state: 'reconnect_needed', reconnectSystem: systemForStep(conn.step) };
  return { state: issues.length ? 'attention' : 'live', reconnectSystem: null };
}
