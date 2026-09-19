import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 4000),
    mongoUri: env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
    dbName: env.MONGODB_DB || 'doorstep',
    callbackSecret: env.CALLBACK_SECRET || '',
    callbackRateLimit: Number(env.CALLBACK_RATE_LIMIT || 300),
    // Demo only: stands in for a session when the page URL carries no ?customer=.
    demoCustomerId: env.DEMO_CUSTOMER_ID || '',
    webDist: env.WEB_DIST || path.resolve(here, '../../web/dist'),
    fastn: {
      host: env.FASTN_HOST || '',
      apiKey: env.FASTN_API_KEY || '',
      orgId: env.FASTN_ORG_ID || '',
      userLevel: env.FASTN_USER_LEVEL === 'true',
    },
  };
}
