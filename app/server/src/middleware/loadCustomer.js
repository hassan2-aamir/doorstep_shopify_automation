import { ObjectId } from 'mongodb';
import { OBJECT_ID_RE } from '../lib/validate.js';
import { httpError } from '../lib/httpError.js';

// Resolves the merchant for every browser endpoint. Handlers read req.customer.fastnEndOrgId and never
// take a customer id from the body. Production would resolve a session here; the demo accepts a
// validated ?customer= ObjectId (falling back to DEMO_CUSTOMER_ID) that must match a customers record.
export function loadCustomer(db, { demoCustomerId }) {
  return async (req, res, next) => {
    try {
      let id = req.query.customer;
      if (id === undefined || id === '') id = demoCustomerId || undefined;
      if (id === undefined) throw httpError(400, 'NO_CUSTOMER', 'No workspace selected');
      if (typeof id !== 'string' || !OBJECT_ID_RE.test(id)) throw httpError(400, 'INVALID', 'customer must be a 24-character id');
      const customer = await db.collection('customers').findOne({ _id: new ObjectId(id) });
      if (!customer) throw httpError(404, 'UNKNOWN_CUSTOMER', 'Workspace not found');
      req.customer = customer;
      next();
    } catch (err) {
      next(err);
    }
  };
}
