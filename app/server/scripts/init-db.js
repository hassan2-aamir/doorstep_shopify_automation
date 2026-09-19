// Creates both collections with their validators and indexes (idempotent). Step 0.7.
import { loadConfig } from '../src/config.js';
import { connect, initCollections } from '../src/db.js';

const config = loadConfig();
const { client, db } = await connect(config.mongoUri, config.dbName);
await initCollections(db);
const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).sort();
console.log(`Initialised ${config.dbName}: ${names.join(', ')}`);
for (const name of ['customers', 'syncEvents']) {
  const idx = (await db.collection(name).indexes()).map((i) => i.name).join(', ');
  console.log(`  ${name} indexes: ${idx}`);
}
await client.close();
