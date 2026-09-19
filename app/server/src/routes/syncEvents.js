import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { parseCallback, parseFeedQuery } from '../lib/validate.js';
import { sanitizeError } from '../lib/sanitize.js';
import { getFeed } from '../lib/views.js';
import { httpError } from '../lib/httpError.js';
import { WORKFLOW_A } from '../lib/vocab.js';

const DAY_MS = 24 * 3600 * 1000;
const FUTURE_SKEW_MS = 5 * 60 * 1000;

function secretMatches(given, expected) {
  if (!expected || typeof given !== 'string') return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// The flow's own run time is trusted only inside a sane window, otherwise the receive time is used.
export function chooseAt(runAt, now) {
  if (!runAt) return now;
  const t = runAt.getTime();
  return t >= now.getTime() - DAY_MS && t <= now.getTime() + FUTURE_SKEW_MS ? runAt : now;
}

export function syncEventsRouter(db, config, loadCustomer) {
  const router = Router();
  const events = db.collection('syncEvents');
  const customers = db.collection('customers');

  const callbackLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: config.callbackRateLimit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many callbacks' } },
  });

  // Callback receiver for Fastn flows. Steps run in the documented order and stop at the first failure.
  router.post('/sync-events', callbackLimiter, async (req, res, next) => {
    try {
      // 1. Secret, constant time. Never logged.
      if (!secretMatches(req.get('x-callback-secret'), config.callbackSecret)) {
        throw httpError(401, 'UNAUTHORIZED', 'Invalid callback secret');
      }
      // 2. Strict shape, plus the failed-event rule.
      const ev = parseCallback(req.body);
      // 3. Sanitise the free text.
      const error = sanitizeError(ev.error);
      // 4. Unknown customers are refused.
      const customer = await customers.findOne({ fastnEndOrgId: ev.customerId });
      if (!customer) throw httpError(404, 'UNKNOWN_CUSTOMER', 'No workspace for this customerId');
      // 5. Timestamps.
      const receivedAt = new Date();
      const at = chooseAt(ev.runAt, receivedAt);
      // 6. Insert; a repeated eventId is a no-op (delivery is at least once).
      try {
        await events.insertOne({
          eventId: ev.eventId,
          customerId: ev.customerId,
          orderId: ev.orderId,
          orderNumber: ev.orderNumber,
          workflow: ev.workflow,
          outcome: ev.outcome,
          step: ev.step,
          errorKind: ev.errorKind,
          error,
          at,
          receivedAt,
        });
      } catch (err) {
        if (err?.code === 11000) return res.status(200).json({ duplicate: true, eventId: ev.eventId });
        throw err;
      }
      // 7. The first successful order intake makes the workspace live.
      if (ev.workflow === WORKFLOW_A && ev.outcome === 'success' && customer.status !== 'live') {
        await customers.updateOne(
          { _id: customer._id, status: { $ne: 'live' } },
          { $set: { status: 'live', liveAt: customer.liveAt ?? receivedAt, updatedAt: receivedAt } },
        );
      }
      res.status(201).json({ stored: true, eventId: ev.eventId });
    } catch (err) {
      next(err);
    }
  });

  router.get('/sync-events', loadCustomer, async (req, res, next) => {
    try {
      const query = parseFeedQuery(req.query);
      res.json(await getFeed(db, req.customer.fastnEndOrgId, query));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
