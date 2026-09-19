import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { MongoClient, ObjectId } from 'mongodb';
import { createApp } from '../src/app.js';
import { initCollections } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import { mintEmbedToken } from '../src/fastn.js';
import { startOfLocalDay } from '../src/lib/views.js';
import { chooseAt } from '../src/routes/syncEvents.js';

const SECRET = 'test-secret';
const SARA_UUID = '8d3c1f52-6b0e-4c1a-9a57-2f4e8b6d0c13';
const OTHER_UUID = '11111111-2222-4333-8444-555555555555';
const A = 'orders-to-fulfillment';
const B = 'tracking-to-shopify-and-buyer';

let client; let db; let server; let base; let sara; let other;
const fetchCalls = [];
const fakeFetch = async (url, init) => {
  fetchCalls.push({ url, init });
  return new Response(JSON.stringify({ data: { token: 'emb_test_token' } }), { status: 200 });
};

before(async () => {
  client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017');
  await client.connect();
  db = client.db(`doorstep_test_${process.pid}`);
  await initCollections(db);
  const config = {
    ...loadConfig({}),
    callbackSecret: SECRET,
    webDist: '/nonexistent',
    fastn: { host: 'https://fastn.example', apiKey: 'fsk_test_abc', orgId: 'org_1', userLevel: true },
  };
  server = createApp({ db, config, fetchImpl: fakeFetch }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await db.dropDatabase();
  await client.close();
});

beforeEach(async () => {
  await db.collection('syncEvents').deleteMany({});
  await db.collection('customers').deleteMany({});
  fetchCalls.length = 0;
  const now = new Date();
  const doc = (name, email, uuid, status) => ({
    name, email, fastnEndOrgId: uuid, status, timezone: 'Asia/Karachi',
    shopDomain: null, sheetUrl: null, liveAt: null, createdAt: now, updatedAt: now,
  });
  sara = { _id: (await db.collection('customers').insertOne(doc("Sara's Threads", 'sara@example.com', SARA_UUID, 'connecting'))).insertedId };
  other = { _id: (await db.collection('customers').insertOne(doc('Other Shop', 'other@example.com', OTHER_UUID, 'live'))).insertedId };
});

let seq = 0;
function callback(overrides = {}) {
  seq += 1;
  return {
    customerId: SARA_UUID,
    eventId: `5551234567890:${overrides.workflow ?? A}:${Date.now()}${seq}`,
    orderId: '5551234567890',
    orderNumber: '1042',
    workflow: A,
    outcome: 'success',
    step: 'upsert_row',
    runAt: new Date().toISOString(),
    ...overrides,
  };
}

async function post(body, secret = SECRET) {
  const res = await fetch(`${base}/api/sync-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(secret !== null ? { 'x-callback-secret': secret } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function get(path, customer = sara._id) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${base}${path}${customer ? `${sep}customer=${customer}` : ''}`);
  return { status: res.status, body: await res.json() };
}

const failedB = (orderId, extra = {}) => callback({
  orderId, workflow: B, outcome: 'failed', step: 'update_status', errorKind: 'connection', error: '401 invalid_grant', ...extra,
});

describe('callback receiver: POST /api/sync-events', () => {
  test('refuses a missing or wrong secret (step 1)', async () => {
    assert.equal((await post(callback(), null)).status, 401);
    assert.equal((await post(callback(), 'nope')).status, 401);
    assert.equal(await db.collection('syncEvents').countDocuments(), 0);
  });

  test('rejects unknown fields, broken enums and the failed-event rule (step 2)', async () => {
    const cases = [
      callback({ extra: 1 }),
      callback({ step: 'append_row' }),
      callback({ workflow: 'something-else' }),
      callback({ orderId: 'gid://shopify/Order/1' }),
      callback({ eventId: 'has spaces' }),
      callback({ customerId: 'not-a-uuid' }),
      callback({ outcome: 'failed' }), // no errorKind / error
      callback({ outcome: 'failed', errorKind: 'weird', error: 'x' }),
      callback({ outcome: 'success', error: 'should not be here' }),
      callback({ outcome: 'skipped', errorKind: 'data' }),
      callback({ runAt: 'yesterday' }),
    ];
    for (const body of cases) {
      const res = await post(body);
      assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
    }
    assert.equal(await db.collection('syncEvents').countDocuments(), 0);
  });

  test('accepts a numeric orderId and uppercase customer UUID', async () => {
    const res = await post(callback({ orderId: 5551234567890, customerId: SARA_UUID.toUpperCase() }));
    assert.equal(res.status, 201);
    const doc = await db.collection('syncEvents').findOne({});
    assert.equal(doc.orderId, '5551234567890');
    assert.equal(doc.customerId, SARA_UUID);
  });

  test('sanitises error text (step 3)', async () => {
    const error = `buyer sara@shop.com phone 03001234567 bell ${'x'.repeat(600)}`;
    const res = await post(failedB('5551234567890', { errorKind: 'data', error, step: 'send_buyer_email' }));
    assert.equal(res.status, 201);
    const doc = await db.collection('syncEvents').findOne({});
    assert.ok(!doc.error.includes('sara@shop.com'));
    assert.ok(doc.error.includes('[email]'));
    assert.ok(doc.error.includes('[number]'));
    assert.ok(!doc.error.includes(''));
    assert.equal(doc.error.length, 500);
  });

  test('refuses an unknown customer (step 4)', async () => {
    const res = await post(callback({ customerId: '99999999-9999-4999-8999-999999999999' }));
    assert.equal(res.status, 404);
  });

  test('trusts runAt only inside the window (step 5)', () => {
    const now = new Date('2026-09-19T10:00:00Z');
    const inside = new Date('2026-09-19T09:00:00Z');
    assert.equal(chooseAt(inside, now), inside);
    assert.equal(chooseAt(new Date('2026-09-17T09:00:00Z'), now), now);
    assert.equal(chooseAt(new Date('2026-09-19T10:10:00Z'), now), now);
    assert.equal(chooseAt(null, now), now);
  });

  test('N5: the same callback twice is stored once and counts do not double (step 6)', async () => {
    const body = callback();
    const first = await post(body);
    const second = await post(body);
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.deepEqual(second.body, { duplicate: true, eventId: body.eventId });
    assert.equal(await db.collection('syncEvents').countDocuments(), 1);
    const feed = await get('/api/sync-events');
    assert.equal(feed.body.counts.synced, 1);
  });

  test('the first Flow A success makes the workspace live (step 7)', async () => {
    await post(callback({ workflow: B, step: 'update_status' }));
    assert.equal((await db.collection('customers').findOne({ _id: sara._id })).status, 'connecting');
    await post(callback());
    const c = await db.collection('customers').findOne({ _id: sara._id });
    assert.equal(c.status, 'live');
    assert.ok(c.liveAt instanceof Date);
  });

  test('rejects bodies over 100 KB and invalid JSON', async () => {
    assert.equal((await post('{"a":')).status, 400);
    const big = JSON.stringify({ ...callback(), error: 'x'.repeat(110 * 1024) });
    assert.equal((await post(big)).status, 413);
  });
});

describe('Sync health feed: GET /api/sync-events', () => {
  test('open issues come first, failed counts distinct order+workflow pairs', async () => {
    await post(callback({ orderId: '1001', orderNumber: '1001' }));
    for (let i = 0; i < 3; i += 1) await post(failedB('1002')); // three retry attempts, one broken order
    await post(callback({ orderId: '1003', orderNumber: '1003' }));
    await post(callback({ orderId: '1004', outcome: 'skipped', step: 'apply_conditions' }));

    const { status, body } = await get('/api/sync-events');
    assert.equal(status, 200);
    assert.deepEqual(body.counts, { synced: 2, skipped: 1, failed: 1, sinceHours: 24 });
    assert.equal(body.openIssueCount, 1);
    const [first] = body.events;
    assert.equal(first.open, true);
    assert.equal(first.orderId, '1002');
    assert.equal(first.reason, 'Google Sheets needs reconnecting');
    assert.equal(first.system, 'sheet');
    assert.equal(first.label, 'Shipping updates');
    assert.equal(new Set(body.events.map((e) => e.eventId)).size, body.events.length);
  });

  test('N4: a later success for the same order and workflow closes the issue', async () => {
    await post(failedB('1002'));
    assert.equal((await get('/api/workspace')).body.openIssueCount, 1);
    await post(callback({ orderId: '1002', workflow: B, step: 'update_status' }));
    const ws = await get('/api/workspace');
    assert.equal(ws.body.openIssueCount, 0);
    const feed = await get('/api/sync-events?filter=issues');
    assert.equal(feed.body.events.length, 0);
  });

  test('every retry attempt of a still-broken order stays open (alert deep links to the first one)', async () => {
    const first = failedB('1002');
    await post(first);
    await post(failedB('1002'));
    await post(failedB('1002'));
    const { body } = await get(`/api/sync-events?event=${encodeURIComponent(first.eventId)}`);
    const linked = body.events.find((e) => e.eventId === first.eventId);
    assert.equal(linked.open, true);
    assert.equal(body.openIssueCount, 1);
    await post(callback({ orderId: '1002', workflow: B, step: 'update_status' }));
    const after = await get(`/api/sync-events?event=${encodeURIComponent(first.eventId)}`);
    assert.equal(after.body.events.find((e) => e.eventId === first.eventId).open, false);
  });

  test('a skipped event never closes an issue', async () => {
    await post(failedB('1002'));
    await post(callback({ orderId: '1002', workflow: B, outcome: 'skipped', step: 'dedupe_check' }));
    assert.equal((await get('/api/workspace')).body.openIssueCount, 1);
  });

  test('N2 support: ?event= always includes that event, even outside the limit', async () => {
    const target = callback({ orderId: '2000' });
    await post(target);
    for (let i = 0; i < 5; i += 1) await post(callback({ orderId: String(3000 + i) }));
    const { body } = await get(`/api/sync-events?limit=2&event=${encodeURIComponent(target.eventId)}`);
    assert.ok(body.events.some((e) => e.eventId === target.eventId));
    assert.ok(body.events.length <= 2);
  });

  test('validates query parameters', async () => {
    for (const q of ['limit=0', 'limit=51', 'limit=abc', 'sinceHours=200', 'filter=all', 'filter[$ne]=x', 'event=bad%20id']) {
      assert.equal((await get(`/api/sync-events?${q}`)).status, 400, q);
    }
  });
});

describe('tenant isolation', () => {
  test('one merchant never sees another merchant\'s events', async () => {
    await post(failedB('1002'));
    const theirs = await get('/api/sync-events', other._id);
    assert.equal(theirs.body.events.length, 0);
    assert.equal(theirs.body.openIssueCount, 0);
  });

  test('unknown, malformed or operator-shaped customer ids are refused', async () => {
    assert.equal((await get('/api/sync-events', new ObjectId())).status, 404);
    assert.equal((await get('/api/sync-events', 'abc')).status, 400);
    assert.equal((await get('/api/sync-events?customer[$ne]=x', null)).status, 400);
    assert.equal((await get('/api/workspace', null)).status, 400); // no DEMO_CUSTOMER_ID in tests
  });
});

describe('workspace', () => {
  test('reconnect outranks other issues and names the system', async () => {
    await post(callback());
    await post(failedB('1044', { errorKind: 'data', step: 'send_buyer_email', error: 'no email' }));
    await post(failedB('1002'));
    const { body } = await get('/api/workspace');
    assert.equal(body.state, 'reconnect_needed');
    assert.equal(body.reconnectSystem, 'sheet');
    assert.equal(body.openIssueCount, 2);
  });

  test('confirm_setup makes it live; link updates are validated', async () => {
    const res = await fetch(`${base}/api/workspace?customer=${sara._id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirm_setup' }),
    });
    assert.equal((await res.json()).state, 'live');

    const bad = await fetch(`${base}/api/workspace?customer=${sara._id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shopDomain: 'evil.com' }),
    });
    assert.equal(bad.status, 400);

    const good = await fetch(`${base}/api/workspace?customer=${sara._id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopDomain: 'saras-threads.myshopify.com', sheetUrl: 'https://docs.google.com/spreadsheets/d/1AbC' }),
    });
    const body = await good.json();
    assert.equal(body.shopDomain, 'saras-threads.myshopify.com');
    assert.equal(body.sheetUrl, 'https://docs.google.com/spreadsheets/d/1AbC');
  });

  test('today counts received, waiting and shipped orders', async () => {
    await post(callback({ orderId: '1' }));
    await post(callback({ orderId: '2' }));
    await post(callback({ orderId: '3' }));
    await post(callback({ orderId: '1', workflow: B, step: 'update_status' }));
    await post(failedB('3'));
    const { body } = await get('/api/workspace');
    assert.deepEqual(body.today, { received: 3, waiting: 1, shipped: 1 });
  });
});

describe('orders (Tier 2)', () => {
  test('stage derives from the latest events', async () => {
    await post(callback({ orderId: '1', orderNumber: '1001' }));
    await post(callback({ orderId: '2', orderNumber: '1002' }));
    await post(callback({ orderId: '2', workflow: B, step: 'update_status' }));
    await post(callback({ orderId: '3', orderNumber: '1003' }));
    await post(failedB('3'));
    const stages = Object.fromEntries((await get('/api/orders')).body.orders.map((o) => [o.orderId, o.stage]));
    assert.deepEqual(stages, { 1: 'waiting', 2: 'shipped', 3: 'needs_attention' });
    assert.equal((await get('/api/orders?stage=shipped')).body.orders.length, 1);
    assert.equal((await get('/api/orders?stage=bogus')).status, 400);
  });

  test('order detail returns an oldest-first timeline, 404 when unknown', async () => {
    await post(callback({ orderId: '7' }));
    await post(failedB('7'));
    const { body } = await get('/api/orders/7');
    assert.equal(body.stage, 'needs_attention');
    assert.deepEqual(body.timeline.map((e) => e.workflow), [A, B]);
    assert.equal(body.timeline[1].open, true);
    assert.equal((await get('/api/orders/8')).status, 404);
    assert.equal((await get('/api/orders/abc')).status, 400);
  });
});

describe('embed token', () => {
  test('mints on the server, moves new to connecting, never leaks the key', async () => {
    await db.collection('customers').updateOne({ _id: sara._id }, { $set: { status: 'new' } });
    const { status, body } = await get('/api/fastn-token');
    assert.equal(status, 200);
    assert.ok(body.url.startsWith('https://fastn.example/api/v1/embed/iframe?token=emb_test_token'));
    assert.ok(body.url.includes(`tenant-id=${SARA_UUID}`));
    assert.ok(!JSON.stringify(body).includes('fsk_test_abc'));
    const sent = fetchCalls[0];
    assert.equal(sent.init.headers.Authorization, 'Bearer fsk_test_abc');
    assert.equal(sent.init.headers['X-fastn-Test-Mode'], 'true');
    assert.equal(JSON.parse(sent.init.body).endOrgId, SARA_UUID);
    assert.equal((await db.collection('customers').findOne({ _id: sara._id })).status, 'connecting');
  });

  test('unconfigured Fastn fails with a 502-class error', async () => {
    await assert.rejects(
      mintEmbedToken({ host: '', apiKey: '' }, {}),
      (err) => err.status === 502 && err.code === 'FASTN_NOT_CONFIGURED',
    );
  });
});

test('health pings MongoDB', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test('local midnight for Asia/Karachi (UTC+5)', () => {
  const midnight = startOfLocalDay('Asia/Karachi', new Date('2026-09-19T10:41:12Z'));
  assert.equal(midnight.toISOString(), '2026-09-18T19:00:00.000Z');
  const earlyMorning = startOfLocalDay('Asia/Karachi', new Date('2026-09-18T20:30:00Z')); // 01:30 local on the 19th
  assert.equal(earlyMorning.toISOString(), '2026-09-18T19:00:00.000Z');
});
