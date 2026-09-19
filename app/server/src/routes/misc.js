import { Router } from 'express';
import { mintEmbedToken, iframeUrl } from '../fastn.js';
import { parseOrderIdParam, parseStage } from '../lib/validate.js';
import { getOrderDetail, getOrders } from '../lib/views.js';
import { httpError } from '../lib/httpError.js';

export function fastnTokenRouter(db, config, loadCustomer, fetchImpl) {
  const router = Router();
  // A fresh token per page load; the API key never leaves the server.
  router.get('/fastn-token', loadCustomer, async (req, res, next) => {
    try {
      const customer = req.customer;
      const now = new Date();
      await db.collection('customers').updateOne(
        { _id: customer._id, status: 'new' },
        { $set: { status: 'connecting', updatedAt: now } },
      );
      const token = await mintEmbedToken(config.fastn, {
        endOrgId: customer.fastnEndOrgId,
        userEmail: customer.email,
        userName: customer.name,
      }, fetchImpl);
      res.set('Cache-Control', 'no-store').json({ url: iframeUrl(config.fastn, token, customer.fastnEndOrgId) });
    } catch (err) {
      next(err);
    }
  });
  return router;
}

export function ordersRouter(db, loadCustomer) {
  const router = Router();
  router.get('/orders', loadCustomer, async (req, res, next) => {
    try {
      const stage = parseStage(req.query);
      res.json({ orders: await getOrders(db, req.customer.fastnEndOrgId, stage) });
    } catch (err) {
      next(err);
    }
  });
  router.get('/orders/:orderId', loadCustomer, async (req, res, next) => {
    try {
      const orderId = parseOrderIdParam(req.params.orderId);
      const detail = await getOrderDetail(db, req.customer.fastnEndOrgId, orderId);
      if (!detail) throw httpError(404, 'ORDER_NOT_FOUND', 'We have no record of this order');
      res.json(detail);
    } catch (err) {
      next(err);
    }
  });
  return router;
}

export function healthRouter(db) {
  const router = Router();
  router.get('/health', async (req, res) => {
    try {
      await db.command({ ping: 1 });
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });
  return router;
}
