// MongoDB access plus the validators and indexes from the Backend schema doc's init script.
// initCollections is idempotent: it creates missing collections and re-applies validators to existing ones.
import { MongoClient } from 'mongodb';
import { WORKFLOWS, OUTCOMES, STEP_NAMES } from './lib/vocab.js';

const UUID = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

const customersSchema = {
  bsonType: 'object', additionalProperties: false,
  required: ['name', 'email', 'fastnEndOrgId', 'status', 'timezone', 'createdAt', 'updatedAt'],
  properties: {
    _id: { bsonType: 'objectId' },
    name: { bsonType: 'string', minLength: 1, maxLength: 80 },
    email: { bsonType: 'string', maxLength: 254, pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
    fastnEndOrgId: { bsonType: 'string', pattern: UUID },
    status: { enum: ['new', 'connecting', 'live'] },
    shopDomain: { bsonType: ['string', 'null'], pattern: '^[a-z0-9][a-z0-9-]*\\.myshopify\\.com$' },
    sheetUrl: { bsonType: ['string', 'null'], pattern: '^https://docs\\.google\\.com/spreadsheets/d/[A-Za-z0-9_-]+' },
    timezone: { bsonType: 'string', maxLength: 64 },
    liveAt: { bsonType: ['date', 'null'] },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
};

const syncEventsSchema = {
  bsonType: 'object', additionalProperties: false,
  required: ['eventId', 'customerId', 'orderId', 'workflow', 'outcome', 'step', 'at', 'receivedAt'],
  properties: {
    _id: { bsonType: 'objectId' },
    eventId: { bsonType: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9:_-]+$' },
    customerId: { bsonType: 'string', pattern: UUID },
    orderId: { bsonType: 'string', pattern: '^[0-9]{1,20}$' },
    orderNumber: { bsonType: ['string', 'null'], maxLength: 32 },
    workflow: { enum: WORKFLOWS },
    outcome: { enum: OUTCOMES },
    step: { enum: STEP_NAMES },
    errorKind: { enum: ['connection', 'data', 'other', null] },
    error: { bsonType: ['string', 'null'], maxLength: 500 },
    at: { bsonType: 'date' },
    receivedAt: { bsonType: 'date' },
  },
};

async function ensureCollection(db, name, schema) {
  const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
  if (exists) {
    await db.command({ collMod: name, validator: { $jsonSchema: schema }, validationLevel: 'strict' });
  } else {
    await db.createCollection(name, { validator: { $jsonSchema: schema } });
  }
}

export async function initCollections(db) {
  await ensureCollection(db, 'customers', customersSchema);
  await ensureCollection(db, 'syncEvents', syncEventsSchema);
  const customers = db.collection('customers');
  const events = db.collection('syncEvents');
  await Promise.all([
    customers.createIndex({ email: 1 }, { unique: true }),
    customers.createIndex({ fastnEndOrgId: 1 }, { unique: true }),
    events.createIndex({ eventId: 1 }, { unique: true }),
    events.createIndex({ customerId: 1, at: -1 }),
    events.createIndex({ customerId: 1, orderId: 1, workflow: 1, at: -1 }),
    events.createIndex({ at: 1 }, { expireAfterSeconds: 2592000 }),
  ]);
}

export async function connect(uri, dbName) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  return { client, db: client.db(dbName) };
}
