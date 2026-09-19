// Minimal host app for a Fastn embedded widget plus a "Sync health" panel.
// Zero dependencies. Needs Node 18+ (global fetch). Run: npm start
//
// What it does
//   1. Mints a short-lived embed token ON THE SERVER (the API key never reaches the browser).
//   2. Serves a page with the Fastn widget in an iframe ("Connect your store").
//   3. Receives outcome callbacks from your Fastn workflows and shows them to the customer,
//      so failures are surfaced instead of dropped. (There is no documented way to poll an
//      execution id, so workflows call back.)
//
// VERIFY against your workspace's Embed tab and workflow API tab: host, token request shape,
// response shape, and whether user-level embeds need `tenant-id`. See references/embedding-and-widget.md.

'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const {
  FASTN_HOST,            // e.g. https://app.fastn.dev or https://live.gcp.fastn.ai : copy from the Embed tab
  FASTN_API_KEY,         // fsk_live_... (or fsk_test_..., which is NOT a sandbox)
  FASTN_ORG_ID = '',     // optional: sent as x-org-id
  FASTN_END_ORG_ID = '', // default customer id (use the customer UUID your workspace shows)
  FASTN_USER_LEVEL = 'false', // "true" => add tenant-id to the iframe URL (per-user connections)
  SYNC_CALLBACK_SECRET = '',  // shared secret your workflows send in x-callback-secret
} = process.env;

// In-memory store. Replace with a real database before anything but a demo.
const MAX_EVENTS = 500;
/** @type {Array<{customerId:string, orderId:string, workflow:string, outcome:string, step?:string, error?:string, at:string}>} */
const events = [];

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(data);
}

function readBody(req, limit = 100 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('payload too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(Object.assign(new Error('invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

async function mintToken({ endOrgId, userEmail, userName }) {
  if (!FASTN_HOST || !FASTN_API_KEY) throw new Error('Set FASTN_HOST and FASTN_API_KEY (see .env.example)');
  const headers = { Authorization: `Bearer ${FASTN_API_KEY}`, 'Content-Type': 'application/json' };
  if (FASTN_API_KEY.startsWith('fsk_test_')) headers['X-fastn-Test-Mode'] = 'true'; // required for test keys only
  if (FASTN_ORG_ID) headers['x-org-id'] = FASTN_ORG_ID;

  const res = await fetch(`${FASTN_HOST.replace(/\/$/, '')}/api/v1/embed/token`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ endOrgId, userEmail, userName }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Branch on error.code, not message. Never log the token or the key.
    const code = body?.error?.code || `HTTP_${res.status}`;
    throw Object.assign(new Error(`Token request failed: ${code}`), { status: 502 });
  }
  const token = body?.data?.token ?? body?.token; // both shapes appear in Fastn docs
  if (!token) throw Object.assign(new Error('Token missing in response'), { status: 502 });
  return token;
}

function iframeSrc(token, endOrgId) {
  const base = `${FASTN_HOST.replace(/\/$/, '')}/api/v1/embed/iframe?token=${encodeURIComponent(token)}`;
  return FASTN_USER_LEVEL === 'true' ? `${base}&tenant-id=${encodeURIComponent(endOrgId)}` : base;
}

function summarize(customerId) {
  const mine = events.filter((e) => e.customerId === customerId);
  const count = (o) => mine.filter((e) => e.outcome === o).length;
  return {
    total: mine.length,
    success: count('success'),
    skipped: count('skipped'),
    failed: count('failed'),
    recent: mine.slice(-50).reverse(),
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true });

    // In a real app, derive the customer from the authenticated session, not from the query string.
    if (req.method === 'GET' && url.pathname === '/api/fastn-token') {
      const endOrgId = url.searchParams.get('customer') || FASTN_END_ORG_ID;
      if (!endOrgId) return json(res, 400, { error: 'No customer id. Set FASTN_END_ORG_ID or pass ?customer=' });
      const token = await mintToken({
        endOrgId,
        userEmail: url.searchParams.get('email') || undefined,
        userName: url.searchParams.get('name') || undefined,
      });
      return json(res, 200, { src: iframeSrc(token, endOrgId) });
    }

    // Workflow callback: POST { customerId, orderId, workflow, outcome: success|skipped|failed, step?, error? }
    if (req.method === 'POST' && url.pathname === '/api/sync-events') {
      if (!SYNC_CALLBACK_SECRET || !safeEqual(req.headers['x-callback-secret'] || '', SYNC_CALLBACK_SECRET)) {
        return json(res, 401, { error: 'unauthorized' });
      }
      const b = await readBody(req);
      if (!b.customerId || !b.orderId || !['success', 'skipped', 'failed'].includes(b.outcome)) {
        return json(res, 400, { error: 'customerId, orderId and outcome (success|skipped|failed) are required' });
      }
      events.push({
        customerId: String(b.customerId), orderId: String(b.orderId), workflow: String(b.workflow || ''),
        outcome: b.outcome, step: b.step ? String(b.step) : undefined,
        error: b.error ? String(b.error).slice(0, 500) : undefined, at: new Date().toISOString(),
      });
      if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url.pathname === '/api/sync-events') {
      const customerId = url.searchParams.get('customer') || FASTN_END_ORG_ID;
      return json(res, 200, summarize(customerId));
    }

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    json(res, 404, { error: 'not found' });
  } catch (err) {
    console.error('request failed:', err.message); // message only: never log tokens or keys
    json(res, err.status || 500, { error: err.message });
  }
});

server.listen(PORT, () => console.log(`Host app on http://localhost:${PORT}`));
