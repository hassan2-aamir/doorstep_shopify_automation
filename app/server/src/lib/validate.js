import { WORKFLOWS, OUTCOMES, ERROR_KINDS, STEP_NAMES } from './vocab.js';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;
const EVENT_ID_RE = /^[A-Za-z0-9:_-]{1,128}$/;
const ORDER_ID_RE = /^[0-9]{1,20}$/;
const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const SHEET_URL_RE = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]+/;

const CALLBACK_FIELDS = new Set([
  'customerId', 'eventId', 'orderId', 'orderNumber', 'workflow',
  'outcome', 'step', 'errorKind', 'error', 'runAt',
]);

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
    this.code = 'INVALID';
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Shopify ids arrive as strings or numbers depending on the connector; content must be digits either way.
function digitString(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  return typeof value === 'string' ? value : null;
}

// Strict: unknown fields are rejected, and a failed event must carry errorKind + error while any other
// outcome must carry neither (the rule the MongoDB validator cannot express).
export function parseCallback(body) {
  if (!isPlainObject(body)) throw new ValidationError('Body must be a JSON object');
  const unknown = Object.keys(body).filter((k) => !CALLBACK_FIELDS.has(k));
  if (unknown.length) throw new ValidationError(`Unknown field(s): ${unknown.join(', ')}`);

  const customerId = typeof body.customerId === 'string' ? body.customerId.toLowerCase() : null;
  if (!customerId || !UUID_RE.test(customerId)) throw new ValidationError('customerId must be a UUID');

  if (typeof body.eventId !== 'string' || !EVENT_ID_RE.test(body.eventId)) {
    throw new ValidationError('eventId must be 1-128 characters of A-Z a-z 0-9 : _ -');
  }

  const orderId = digitString(body.orderId);
  if (!orderId || !ORDER_ID_RE.test(orderId)) throw new ValidationError('orderId must be 1-20 digits');

  let orderNumber = null;
  if (body.orderNumber !== undefined && body.orderNumber !== null) {
    orderNumber = typeof body.orderNumber === 'number' ? String(body.orderNumber) : body.orderNumber;
    if (typeof orderNumber !== 'string' || orderNumber.length > 32) {
      throw new ValidationError('orderNumber must be a string of at most 32 characters');
    }
  }

  if (!WORKFLOWS.includes(body.workflow)) throw new ValidationError(`workflow must be one of ${WORKFLOWS.join(', ')}`);
  if (!OUTCOMES.includes(body.outcome)) throw new ValidationError(`outcome must be one of ${OUTCOMES.join(', ')}`);
  if (!STEP_NAMES.includes(body.step)) throw new ValidationError(`step must be one of ${STEP_NAMES.join(', ')}`);

  const hasKind = body.errorKind !== undefined && body.errorKind !== null;
  const hasError = body.error !== undefined && body.error !== null;
  if (body.outcome === 'failed') {
    if (!ERROR_KINDS.includes(body.errorKind)) throw new ValidationError(`A failed event needs errorKind: ${ERROR_KINDS.join(', ')}`);
    if (typeof body.error !== 'string' || !body.error.trim()) throw new ValidationError('A failed event needs a non-empty error');
  } else if (hasKind || hasError) {
    throw new ValidationError('Only a failed event may carry errorKind or error');
  }

  let runAt = null;
  if (body.runAt !== undefined && body.runAt !== null) {
    const d = typeof body.runAt === 'string' ? new Date(body.runAt) : null;
    if (!d || Number.isNaN(d.getTime())) throw new ValidationError('runAt must be an ISO 8601 timestamp');
    runAt = d;
  }

  return {
    customerId,
    eventId: body.eventId,
    orderId,
    orderNumber,
    workflow: body.workflow,
    outcome: body.outcome,
    step: body.step,
    errorKind: body.outcome === 'failed' ? body.errorKind : null,
    error: body.outcome === 'failed' ? body.error : null,
    runAt,
  };
}

// Query parsing: each parameter is parsed to its exact type. Arrays and objects (qs turns
// `filter[$ne]=x` into an object) are rejected so they can never reach MongoDB as operators.
function scalar(query, name) {
  const v = query[name];
  if (v === undefined) return undefined;
  if (typeof v !== 'string') throw new ValidationError(`${name} must be a single value`);
  return v;
}

function intInRange(query, name, min, max, fallback) {
  const v = scalar(query, name);
  if (v === undefined || v === '') return fallback;
  if (!/^\d+$/.test(v)) throw new ValidationError(`${name} must be an integer`);
  const n = Number(v);
  if (n < min || n > max) throw new ValidationError(`${name} must be between ${min} and ${max}`);
  return n;
}

export function parseFeedQuery(query) {
  const filter = scalar(query, 'filter');
  if (filter !== undefined && filter !== '' && filter !== 'issues') throw new ValidationError('filter must be "issues" or absent');
  const event = scalar(query, 'event');
  if (event !== undefined && event !== '' && !EVENT_ID_RE.test(event)) throw new ValidationError('event is not a valid eventId');
  return {
    issuesOnly: filter === 'issues',
    event: event || null,
    limit: intInRange(query, 'limit', 1, 50, 50),
    sinceHours: intInRange(query, 'sinceHours', 1, 168, 24),
  };
}

export const STAGES = ['waiting', 'shipped', 'needs_attention'];

export function parseStage(query) {
  const stage = scalar(query, 'stage');
  if (stage === undefined || stage === '' || stage === 'all') return null;
  if (!STAGES.includes(stage)) throw new ValidationError(`stage must be one of ${STAGES.join(', ')}`);
  return stage;
}

export function parseOrderIdParam(value) {
  if (typeof value !== 'string' || !ORDER_ID_RE.test(value)) throw new ValidationError('orderId must be 1-20 digits');
  return value;
}

export function parseWorkspaceUpdate(body) {
  if (!isPlainObject(body)) throw new ValidationError('Body must be a JSON object');
  const keys = Object.keys(body);
  if (keys.length === 1 && body.action === 'confirm_setup') return { action: 'confirm_setup' };

  const allowed = new Set(['shopDomain', 'sheetUrl']);
  if (!keys.length || keys.some((k) => !allowed.has(k))) {
    throw new ValidationError('Send {"action":"confirm_setup"} or {"shopDomain","sheetUrl"}');
  }
  const update = {};
  if ('shopDomain' in body) {
    const v = body.shopDomain;
    if (v !== null && (typeof v !== 'string' || !SHOP_DOMAIN_RE.test(v))) {
      throw new ValidationError('shopDomain must look like name.myshopify.com');
    }
    update.shopDomain = v;
  }
  if ('sheetUrl' in body) {
    const v = body.sheetUrl;
    if (v !== null && (typeof v !== 'string' || !SHEET_URL_RE.test(v) || v.length > 500)) {
      throw new ValidationError('sheetUrl must start with https://docs.google.com/spreadsheets/d/');
    }
    update.sheetUrl = v;
  }
  return { action: 'update', update };
}
