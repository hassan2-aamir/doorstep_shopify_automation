// Posts scripted workflow callbacks through the REAL receiver (secret, validation, dedup), so the app
// can be exercised and screenshotted before the Fastn flows exist. Never a substitute for T1-T9.
// usage: npm run demo-events -- --scenario happy|failure|recover|reset [--base http://localhost:4000] [--fastn <uuid>]
import { parseArgs } from 'node:util';
import { ObjectId } from 'mongodb';
import { loadConfig } from '../src/config.js';
import { connect } from '../src/db.js';

const { values } = parseArgs({
  options: {
    scenario: { type: 'string', default: 'happy' },
    base: { type: 'string', default: 'http://localhost:4000' },
    fastn: { type: 'string' },
  },
});

const config = loadConfig();
const { client, db } = await connect(config.mongoUri, config.dbName);

let customerId = values.fastn?.toLowerCase();
if (!customerId && config.demoCustomerId) {
  const c = await db.collection('customers').findOne({ _id: new ObjectId(config.demoCustomerId) });
  customerId = c?.fastnEndOrgId;
}
if (!customerId) {
  console.error('No customer: pass --fastn <uuid> or set DEMO_CUSTOMER_ID in .env');
  process.exit(1);
}

if (values.scenario === 'reset') {
  const { deletedCount } = await db.collection('syncEvents').deleteMany({ customerId });
  await db.collection('customers').updateOne({ fastnEndOrgId: customerId }, { $set: { status: 'connecting', liveAt: null, updatedAt: new Date() } });
  console.log(`Removed ${deletedCount} events and set the workspace back to connecting.`);
  await client.close();
  process.exit(0);
}
await client.close();

const A = 'orders-to-fulfillment';
const B = 'tracking-to-shopify-and-buyer';
const orders = [
  { orderId: '5551234567041', orderNumber: '1041' },
  { orderId: '5551234567042', orderNumber: '1042' },
  { orderId: '5551234567043', orderNumber: '1043' },
  { orderId: '5551234567044', orderNumber: '1044' },
];

let tick = Math.floor(Date.now() / 1000) - 600;
const ev = (o, workflow, outcome, step, extra = {}) => {
  tick += 7;
  return {
    customerId,
    eventId: `${o.orderId}:${workflow}:${tick}`,
    orderId: o.orderId,
    orderNumber: o.orderNumber,
    workflow,
    outcome,
    step,
    runAt: new Date(tick * 1000).toISOString(),
    ...extra,
  };
};

const scenarios = {
  // Four orders reach the sheet, one test order is skipped, one order ships.
  happy: () => [
    ev(orders[0], A, 'success', 'upsert_row'),
    ev(orders[1], A, 'success', 'upsert_row'),
    ev(orders[2], A, 'success', 'upsert_row'),
    ev(orders[3], A, 'success', 'upsert_row'),
    ev({ orderId: '5551234567099', orderNumber: '1099' }, A, 'skipped', 'apply_conditions'),
    ev(orders[0], B, 'success', 'update_status'),
  ],
  // J3: the sheet was disconnected; Flow B fails on #1042 across three retry attempts, and #1044 has no buyer email.
  failure: () => [
    ev(orders[1], B, 'failed', 'update_status', { errorKind: 'connection', error: '401 invalid_grant: token has been expired or revoked' }),
    ev(orders[1], B, 'failed', 'update_status', { errorKind: 'connection', error: '401 invalid_grant: token has been expired or revoked' }),
    ev(orders[1], B, 'failed', 'update_status', { errorKind: 'connection', error: '401 invalid_grant: token has been expired or revoked' }),
    ev(orders[3], B, 'failed', 'send_buyer_email', { errorKind: 'data', error: 'buyer_email is empty for order' }),
  ],
  // After reconnecting, the next Flow B run succeeds and the connection issue closes itself.
  recover: () => [
    ev(orders[1], B, 'success', 'update_status'),
  ],
};

const build = scenarios[values.scenario];
if (!build) {
  console.error(`Unknown scenario "${values.scenario}". Use happy, failure, recover or reset.`);
  process.exit(1);
}

for (const body of build()) {
  const res = await fetch(`${values.base.replace(/\/$/, '')}/api/sync-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-callback-secret': config.callbackSecret },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  console.log(`${res.status} #${body.orderNumber} ${body.workflow} ${body.outcome}${out.duplicate ? ' (duplicate)' : ''}${out.error ? ` ${out.error.code}` : ''}`);
}
