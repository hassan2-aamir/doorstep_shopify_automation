import { loadConfig } from './config.js';
import { connect, initCollections } from './db.js';
import { createApp } from './app.js';

const config = loadConfig();
if (!config.callbackSecret) console.warn('CALLBACK_SECRET is empty: every workflow callback will be refused (401).');
if (!config.fastn.host || !config.fastn.apiKey) console.warn('FASTN_HOST / FASTN_API_KEY not set: the Connections widget will show its error state.');

const { db } = await connect(config.mongoUri, config.dbName);
await initCollections(db);
createApp({ db, config }).listen(config.port, () => {
  console.log(`Doorstep API on http://localhost:${config.port} (db ${config.dbName})`);
});
