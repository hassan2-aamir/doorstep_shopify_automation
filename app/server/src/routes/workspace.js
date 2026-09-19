import { Router } from 'express';
import { parseWorkspaceUpdate } from '../lib/validate.js';
import { getOpenIssues, getTodayCounts, workspaceState } from '../lib/views.js';

// One response feeds the status pill, Today and the setup checklist.
export async function workspaceBody(db, customer) {
  const issues = await getOpenIssues(db, customer.fastnEndOrgId);
  const { state, reconnectSystem } = workspaceState(customer, issues);
  return {
    name: customer.name,
    status: customer.status,
    state,
    reconnectSystem,
    openIssueCount: issues.length,
    shopDomain: customer.shopDomain ?? null,
    sheetUrl: customer.sheetUrl ?? null,
    timezone: customer.timezone,
    today: await getTodayCounts(db, customer),
  };
}

export function workspaceRouter(db, loadCustomer) {
  const router = Router();
  const customers = db.collection('customers');

  router.get('/workspace', loadCustomer, async (req, res, next) => {
    try {
      res.json(await workspaceBody(db, req.customer));
    } catch (err) {
      next(err);
    }
  });

  router.post('/workspace', loadCustomer, async (req, res, next) => {
    try {
      const change = parseWorkspaceUpdate(req.body);
      const now = new Date();
      const set = change.action === 'confirm_setup'
        ? { status: 'live', liveAt: req.customer.liveAt ?? now, updatedAt: now }
        : { ...change.update, updatedAt: now };
      await customers.updateOne({ _id: req.customer._id }, { $set: set });
      const fresh = await customers.findOne({ _id: req.customer._id });
      res.json(await workspaceBody(db, fresh));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
