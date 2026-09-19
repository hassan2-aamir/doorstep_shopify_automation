// Upserts the demo merchant (by email) and prints the _id to use as DEMO_CUSTOMER_ID / ?customer=.
// usage: npm run seed -- --fastn <customer-uuid> [--name "Sara's Threads"] [--email sara@example.com]
//        [--shop saras-threads.myshopify.com] [--sheet https://docs.google.com/spreadsheets/d/...]
//        [--timezone Asia/Karachi] [--status connecting]
import { parseArgs } from 'node:util';
import { loadConfig } from '../src/config.js';
import { connect, initCollections } from '../src/db.js';

const { values } = parseArgs({
  options: {
    fastn: { type: 'string' },
    name: { type: 'string', default: "Sara's Threads" },
    email: { type: 'string', default: 'sara@example.com' },
    shop: { type: 'string' },
    sheet: { type: 'string' },
    timezone: { type: 'string', default: 'Asia/Karachi' },
    status: { type: 'string', default: 'connecting' },
  },
});

if (!values.fastn) {
  console.error('Pass the Fastn customer UUID: npm run seed -- --fastn <uuid>  (Fastn dashboard, Settings > Customers)');
  process.exit(1);
}

const config = loadConfig();
const { client, db } = await connect(config.mongoUri, config.dbName);
await initCollections(db);

const now = new Date();
const set = {
  name: values.name,
  fastnEndOrgId: values.fastn.toLowerCase(),
  status: values.status,
  timezone: values.timezone,
  updatedAt: now,
};
if (values.shop) set.shopDomain = values.shop;
if (values.sheet) set.sheetUrl = values.sheet;

try {
  const result = await db.collection('customers').findOneAndUpdate(
    { email: values.email.toLowerCase() },
    { $set: set, $setOnInsert: { email: values.email.toLowerCase(), createdAt: now, liveAt: null } },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(`Seeded ${result.name} (${result.status})`);
  console.log(`  customer _id      ${result._id}   -> DEMO_CUSTOMER_ID / ?customer=`);
  console.log(`  fastnEndOrgId     ${result.fastnEndOrgId}   -> customerId in callbacks`);
} catch (err) {
  console.error(`Seed failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.close();
}
