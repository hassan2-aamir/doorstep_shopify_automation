// Navigation acceptance tests N1-N7 (App flow doc) against a real Doorstep server + MongoDB, driven in
// the locally installed Chrome (or Edge). Callbacks go through the real receiver with the real secret.
//
// It starts its own server on :4001 pointed at a mock Fastn token/iframe endpoint on :4100, so the
// widget area renders and N7 (token expiry) can be exercised. The mock stands in for Fastn only there;
// the message the real widget posts on expiry is still an open question to verify.
//
// Needs: a LOCAL MongoDB running (never the .env one, see below), app/server/.env for CALLBACK_SECRET and DEMO_CUSTOMER_ID, app/web built.
// Leaves the demo workspace in a clean "happy" state when done.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { MongoClient, ObjectId } from 'mongodb';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const serverDir = path.join(repo, 'app/server');
const shotsDir = path.join(repo, 'evidence/screenshots/app');
fs.mkdirSync(shotsDir, { recursive: true });

const env = Object.fromEntries(
  fs.readFileSync(path.join(serverDir, '.env'), 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
// This suite WIPES the demo customer's events and resets the workspace. The database therefore never comes from
// .env (which may point at Atlas and production data): it is local MongoDB unless E2E_MONGODB_URI says otherwise,
// and a non-local URI is refused without an explicit E2E_ALLOW_REMOTE=1.
const MONGO_URI = process.env.E2E_MONGODB_URI || 'mongodb://127.0.0.1:27017';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(MONGO_URI) && process.env.E2E_ALLOW_REMOTE !== '1') {
  console.error('Refusing to run: the e2e suite deletes events and would run against a remote database. Set E2E_ALLOW_REMOTE=1 if you really mean it.');
  process.exit(2);
}
env.MONGODB_URI = MONGO_URI;
env.MONGODB_DB = process.env.E2E_MONGODB_DB || 'doorstep';
const SECRET = env.CALLBACK_SECRET;
const CUSTOMER = env.DEMO_CUSTOMER_ID;
const PORT = 4001;
const BASE = `http://localhost:${PORT}`;
const UNCONFIGURED_BASE = process.env.UNCONFIGURED_BASE || 'http://localhost:4000';
const A = 'orders-to-fulfillment';
const B = 'tracking-to-shopify-and-buyer';

// ---------- mock Fastn embed endpoints ----------
let tokenCount = 0;
let expireNextIframe = false;
const mock = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/v1/embed/token') {
    tokenCount += 1;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ data: { token: `emb_mock_${tokenCount}` } }));
  }
  if (req.url.startsWith('/api/v1/embed/iframe')) {
    const token = new URL(req.url, 'http://mock').searchParams.get('token') ?? '';
    const expire = expireNextIframe;
    expireNextIframe = false;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(`<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;padding:24px;background:#fff;color:#1E1B4B">
<h2 style="margin:0 0 8px">Mock Fastn widget</h2><p>Shopify · Google Sheets · Gmail</p><p id="token">${token.replace(/[^a-z0-9_]/gi, '')}</p>
${expire ? "<script>setTimeout(function(){parent.postMessage('fastn:session-expired','*')},600)</script>" : ''}</body>`);
  }
  res.writeHead(404).end();
});

// ---------- helpers ----------
const results = [];
async function check(id, name, fn) {
  const started = Date.now();
  try {
    const note = await fn();
    results.push({ id, name, pass: true, note: note ?? '', ms: Date.now() - started });
    console.log(`PASS ${id} ${name}${note ? ` (${note})` : ''}`);
  } catch (err) {
    results.push({ id, name, pass: false, note: err.message.split('\n')[0], ms: Date.now() - started });
    console.log(`FAIL ${id} ${name}: ${err.message.split('\n')[0]}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

let fastnUuid;
let tick = Math.floor(Date.now() / 1000) - 1800;
function ev(orderId, orderNumber, workflow, outcome, step, extra = {}) {
  tick += 5;
  return {
    customerId: fastnUuid, eventId: `${orderId}:${workflow}:${tick}`, orderId, orderNumber,
    workflow, outcome, step, runAt: new Date(tick * 1000).toISOString(), ...extra,
  };
}
async function post(body) {
  const res = await fetch(`${BASE}/api/sync-events`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-callback-secret': SECRET }, body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}
async function postAll(list) { for (const b of list) { const r = await post(b); assert(r.status === 201, `callback ${b.eventId} -> ${r.status}`); } }
const apiGet = async (p) => (await fetch(`${BASE}${p}${p.includes('?') ? '&' : '?'}customer=${CUSTOMER}`)).json();

const O = {
  o41: ['5551234567041', '1041'], o42: ['5551234567042', '1042'],
  o43: ['5551234567043', '1043'], o44: ['5551234567044', '1044'],
};
const conn = (o) => ev(...o, B, 'failed', 'update_status', { errorKind: 'connection', error: '401 invalid_grant: token has been expired or revoked' });
const happy = () => [
  ev(...O.o41, A, 'success', 'upsert_row'), ev(...O.o42, A, 'success', 'upsert_row'),
  ev(...O.o43, A, 'success', 'upsert_row'), ev(...O.o44, A, 'success', 'upsert_row'),
  ev('5551234567099', '1099', A, 'skipped', 'apply_conditions'),
  ev(...O.o41, B, 'success', 'update_status'),
];

async function waitForServer(url, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server at ${url} did not come up`);
}

async function launchBrowser() {
  for (const channel of ['chrome', 'msedge']) {
    try { return await chromium.launch({ channel, headless: true }); } catch { /* try next */ }
  }
  throw new Error('No local Chrome or Edge found for playwright-core');
}

// ---------- run ----------
const mongo = new MongoClient(env.MONGODB_URI || 'mongodb://127.0.0.1:27017');
await mongo.connect();
const db = mongo.db(env.MONGODB_DB || 'doorstep');
const customer = await db.collection('customers').findOne({ _id: new ObjectId(CUSTOMER) });
if (!customer) throw new Error('Demo customer not found: run npm run seed in app/server');
fastnUuid = customer.fastnEndOrgId;
async function reset(status = 'connecting') {
  await db.collection('syncEvents').deleteMany({ customerId: fastnUuid });
  await db.collection('customers').updateOne({ _id: customer._id }, { $set: { status, liveAt: null, updatedAt: new Date() } });
}

await new Promise((r) => mock.listen(4100, r));
const server = spawn(process.execPath, ['src/index.js'], {
  cwd: serverDir,
  env: { ...process.env, ...env, PORT: String(PORT), FASTN_HOST: 'http://localhost:4100', FASTN_API_KEY: 'fsk_test_mock', FASTN_USER_LEVEL: 'true' },
  stdio: 'ignore',
});
await waitForServer(`${BASE}/api/health`);
const browser = await launchBrowser();

try {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
  const page = await desktop.newPage();
  const pill = () => page.locator('header [role="status"]').innerText();
  // Viewport captures: full-page captures of a scrolled page misplace the sticky header and rail.
  const shot = (name, p = page) => p.screenshot({ path: path.join(shotsDir, name) });

  await reset();
  await check('S0', 'Setup state: verdict and pill ask Sara to finish setup', async () => {
    await page.goto(`${BASE}/today?customer=${CUSTOMER}`);
    await page.getByText('Finish setup to start moving orders').waitFor();
    assert((await pill()).includes('FINISH SETUP'), `pill was "${await pill()}"`);
    await shot('01-today-setup.png');
  });

  await postAll(happy());
  await check('S1', 'Live state: orders moving, counts right', async () => {
    await page.reload();
    await page.getByText('All orders are moving').waitFor();
    assert((await pill()).includes('ALL SYNCING'), `pill was "${await pill()}"`);
    const ws = await apiGet('/api/workspace');
    assert(ws.today.received === 4 && ws.today.waiting === 3 && ws.today.shipped === 1, `today ${JSON.stringify(ws.today)}`);
    await shot('02-today-live.png');
    const dark = await browser.newContext({ viewport: { width: 1280, height: 1000 }, colorScheme: 'dark', reducedMotion: 'reduce' });
    const dp = await dark.newPage();
    await dp.goto(`${BASE}/today?customer=${CUSTOMER}`);
    await dp.getByText('All orders are moving').waitFor();
    assert(await dp.evaluate(() => document.documentElement.classList.contains('dark')), 'dark class not applied');
    await shot('03-today-dark.png', dp);
    await dark.close();
    return 'received 4, waiting 3, shipped 1; dark mode follows the system';
  });

  const dataFail = ev(...O.o44, B, 'failed', 'send_buyer_email', { errorKind: 'data', error: 'buyer_email is empty' });
  await postAll([dataFail]);
  await check('N1', 'One failed event: banner + pill show it; the pill opens Sync health issues', async () => {
    await page.reload();
    await page.getByText('1 order needs attention').first().waitFor();
    assert((await pill()).includes('1 NEEDS ATTENTION'), `pill was "${await pill()}"`);
    await page.locator('header a').filter({ has: page.locator('[role="status"]') }).click();
    await page.waitForURL('**/sync-health?filter=issues');
  });

  const firstAttempt = conn(O.o42);
  await postAll([firstAttempt, conn(O.o42), conn(O.o42)]);
  let fresh;
  await check('N2', 'Cold deep link from the alert email opens that event expanded with its reason and Fix', async () => {
    fresh = await desktop.newPage();
    await fresh.goto(`${BASE}/sync-health?event=${encodeURIComponent(firstAttempt.eventId)}`);
    const row = fresh.locator(`[data-event-id="${firstAttempt.eventId}"]`);
    await row.waitFor();
    assert(await row.locator('button[aria-expanded]').first().getAttribute('aria-expanded') === 'true', 'row not expanded');
    await row.getByText('Google Sheets needs reconnecting').first().waitFor();
    await row.getByRole('link', { name: 'Reconnect Google Sheet' }).waitFor();
    await shot('04-sync-health-issue.png', fresh);
    return 'links to the FIRST retry attempt, which stays open';
  });

  await check('N3', 'Fix opens Connections focused on the sheet; returning lands back with a toast', async () => {
    const row = fresh.locator(`[data-event-id="${firstAttempt.eventId}"]`);
    await row.getByRole('link', { name: 'Reconnect Google Sheet' }).click();
    await fresh.waitForURL(/\/connections\?focus=sheet&returnTo=/);
    const focused = fresh.locator('[aria-current="true"]');
    await focused.getByText('Google Sheet').first().waitFor();
    await focused.getByText('Needs reconnect').waitFor();
    await fresh.locator('iframe[title^="Connect your accounts"]').waitFor();
    await shot('05-connections-focus.png', fresh);
    await fresh.getByRole('button', { name: 'Done, take me back' }).click();
    await fresh.waitForURL(/\/sync-health\?event=/);
    await fresh.getByText('Google Sheet reconnected. Retrying within 5 minutes.').waitFor();
  });

  await check('N4', 'The next successful runs close the issues with no manual action; pill reads All syncing', async () => {
    await postAll([ev(...O.o42, B, 'success', 'update_status'), ev(...O.o44, B, 'success', 'update_status')]);
    await fresh.locator('header [role="status"]').getByText('All syncing').waitFor({ timeout: 25000 });
    const linked = fresh.locator(`[data-event-id="${firstAttempt.eventId}"]`);
    await linked.getByText('Resolved').waitFor({ timeout: 10000 });
    return 'no reload: picked up by the 15 s / 5 s polls';
  });

  await check('N5', 'The same callback posted twice is stored once; counts do not change', async () => {
    const body = ev(...O.o43, B, 'success', 'update_status');
    const before = (await apiGet('/api/sync-events')).counts;
    const r1 = await post(body);
    const mid = (await apiGet('/api/sync-events')).counts;
    const r2 = await post(body);
    const after = (await apiGet('/api/sync-events')).counts;
    assert(r1.status === 201 && r2.status === 200 && r2.body.duplicate === true, `statuses ${r1.status}/${r2.status}`);
    assert(mid.synced === before.synced + 1 && after.synced === mid.synced, 'count changed on duplicate');
    return '201 then 200 {duplicate:true}';
  });

  // Put an open connection issue back so the mobile + keyboard checks have a Fix to reach.
  await postAll([conn(O.o43)]);
  await check('N6', 'Usable at 360 px and by keyboard only', async () => {
    const mobile = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const mp = await mobile.newPage();
    const notes = [];
    for (const route of ['/today', '/orders', '/sync-health', '/connections']) {
      await mp.goto(`${BASE}${route}?customer=${CUSTOMER}`);
      await mp.locator('h1').waitFor();
      const { sw, cw } = await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      assert(sw <= cw, `${route}: horizontal scroll (${sw} > ${cw})`);
    }
    const tabs = mp.locator('nav[aria-label="Main"]:visible a');
    assert(await tabs.count() === 4, 'tab bar does not show 4 destinations');
    for (let i = 0; i < 4; i += 1) {
      const box = await tabs.nth(i).boundingBox();
      assert(box.width >= 44 && box.height >= 44, `tab ${i} is ${box.width}x${box.height}`);
    }
    await mp.goto(`${BASE}/today?customer=${CUSTOMER}`);
    await mp.getByText('needs reconnecting').first().waitFor();
    await shot('06-mobile-today.png', mp);
    await mp.goto(`${BASE}/sync-health?filter=issues&customer=${CUSTOMER}`);
    await mp.locator('[data-event-id] button[aria-expanded]').first().click();
    await shot('07-mobile-sync-health.png', mp);
    await mobile.close();
    notes.push('4 routes no h-scroll, tabs >= 44 px');

    // Keyboard only: reach an issue row, open it, reach Fix, activate it.
    const kp = await desktop.newPage();
    await kp.goto(`${BASE}/sync-health?filter=issues&customer=${CUSTOMER}`);
    await kp.locator('[data-event-id]').first().waitFor();
    let onRow = false;
    for (let i = 0; i < 40 && !onRow; i += 1) {
      await kp.keyboard.press('Tab');
      onRow = await kp.evaluate(() => document.activeElement?.getAttribute('aria-controls')?.startsWith('event-panel') ?? false);
    }
    assert(onRow, 'Tab never reached an event row');
    const outline = await kp.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    assert(outline !== 'none', 'focused row has no visible focus outline');
    await kp.keyboard.press('Enter');
    let onFix = false;
    for (let i = 0; i < 10 && !onFix; i += 1) {
      await kp.keyboard.press('Tab');
      onFix = await kp.evaluate(() => /^Reconnect/.test(document.activeElement?.textContent?.trim() ?? ''));
    }
    assert(onFix, 'Tab never reached the Fix action');
    await kp.keyboard.press('Enter');
    await kp.waitForURL(/\/connections\?focus=sheet/);
    await kp.close();
    notes.push('Tab > Enter > Tab > Enter reaches Connections, focus ring visible');
    return notes.join('; ');
  });

  await check('N7', 'Embed token expiry reloads the widget in place (simulated widget message)', async () => {
    expireNextIframe = true;
    const cp = await desktop.newPage();
    await cp.goto(`${BASE}/connections?customer=${CUSTOMER}`);
    const frame = cp.locator('iframe[title^="Connect your accounts"]');
    await frame.waitFor();
    const firstSrc = await frame.getAttribute('src');
    await cp.waitForFunction((src) => document.querySelector('iframe')?.getAttribute('src') !== src, firstSrc, { timeout: 10000 });
    const secondSrc = await frame.getAttribute('src');
    assert(new URL(cp.url()).pathname === '/connections', 'navigated away from Connections');
    assert(firstSrc.match(/token=([^&]+)/)[1] !== secondSrc.match(/token=([^&]+)/)[1], 'token did not change');
    await cp.close();
    return `${firstSrc.match(/token=([^&]+)/)[1]} -> ${secondSrc.match(/token=([^&]+)/)[1]}`;
  });

  await check('E1', 'Token mint failure shows "Couldn\'t load your connections" with Retry (unconfigured server)', async () => {
    const ep = await desktop.newPage();
    try {
      await ep.goto(`${UNCONFIGURED_BASE}/connections?customer=${CUSTOMER}`);
    } catch {
      throw new Error(`no unconfigured server at ${UNCONFIGURED_BASE} (start app/server without FASTN_* to run this)`);
    }
    await ep.getByText("Couldn't load your connections").waitFor();
    await ep.getByRole('button', { name: 'Retry' }).waitFor();
    await shot('08-connections-error.png', ep);
    await ep.close();
  });

  await check('E2', 'Orders pipeline and drawer: stage pills, timeline, Escape returns focus to the row', async () => {
    const op = await desktop.newPage();
    await op.goto(`${BASE}/orders?customer=${CUSTOMER}`);
    const row = op.locator('[data-order-id="5551234567043"]');
    await row.waitFor();
    await row.getByText('Needs attention').waitFor();
    await row.click();
    await op.getByRole('dialog').getByText('Timeline').waitFor();
    await shot('09-order-drawer.png', op);
    await op.keyboard.press('Escape');
    await op.waitForURL(/\/orders(\?|$)/);
    await op.waitForFunction(() => document.activeElement?.getAttribute('data-order-id') === '5551234567043');
    await op.close();
  });

  await check('E3', 'Unknown route shows Page not found with a link to Today', async () => {
    await page.goto(`${BASE}/nowhere`);
    await page.getByRole('heading', { name: 'Page not found' }).waitFor();
    await page.getByRole('link', { name: 'Go to Today' }).click();
    await page.waitForURL('**/today');
  });

  // ---------- Landing and onboarding (Tier 3) ----------
  const workspace = () => db.collection('customers').findOne({ _id: customer._id });
  const noHScroll = async (p, route) => {
    await p.goto(`${BASE}${route}`);
    await p.locator('h1').waitFor();
    const { sw, cw } = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    assert(sw <= cw, `${route}: horizontal scroll (${sw} > ${cw})`);
  };

  await reset('connecting');
  await db.collection('customers').updateOne({ _id: customer._id }, { $set: { shopDomain: null, sheetUrl: null } });

  await check('L1', 'Landing page: one h1, CTAs to Setup and the live dashboard, usable at 360 px', async () => {
    const lp = await desktop.newPage();
    await lp.goto(`${BASE}/welcome?customer=${CUSTOMER}`);
    await lp.getByRole('heading', { level: 1, name: /Paid orders reach the doorstep/ }).waitFor();
    assert(await lp.locator('h1').count() === 1, 'landing must have exactly one h1');
    await shot('11-landing.png', lp);
    const mobile = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const mp = await mobile.newPage();
    await noHScroll(mp, `/welcome?customer=${CUSTOMER}`);
    await shot('12-landing-mobile.png', mp);
    await mobile.close();
    await lp.getByRole('link', { name: /Set up your store/ }).first().click();
    await lp.waitForURL('**/setup');
    await lp.close();
    return 'h1, CTA to /setup, no h-scroll at 360 px';
  });

  await check('L2', "'/' is the landing page whatever state the workspace is in, and it links on to Setup", async () => {
    await page.goto(`${BASE}/?customer=${CUSTOMER}`);
    await page.getByRole('heading', { level: 1, name: /Paid orders reach the doorstep/ }).waitFor();
    assert(new URL(page.url()).pathname === '/', `redirected to ${new URL(page.url()).pathname}`);
    await page.getByRole('link', { name: 'See the live dashboard' }).click();
    await page.waitForURL('**/today');
  });

  await check('L3', 'Setup: validates each step, saves Store and Sheet, Go live reaches Today', async () => {
    const sp = await desktop.newPage();
    await sp.goto(`${BASE}/setup?customer=${CUSTOMER}`);
    await sp.getByRole('heading', { name: 'Connect your Shopify store' }).waitFor();
    await sp.getByRole('button', { name: /Store connected, continue/ }).click();
    await sp.getByRole('alert').filter({ hasText: 'your-store.myshopify.com' }).waitFor();
    assert(await sp.getByLabel('Store address').getAttribute('aria-invalid') === 'true', 'store field not marked invalid');
    await sp.getByLabel('Store address').fill('https://Test-Store.myshopify.com/admin');
    await sp.frameLocator('iframe').getByText('Mock Fastn widget').waitFor();
    await sp.evaluate(() => window.scrollTo(0, 0));
    await shot('13-setup-store.png', sp);
    await sp.getByRole('button', { name: /Store connected, continue/ }).click();
    await sp.waitForURL(/step=sheet/);
    await sp.getByRole('heading', { name: 'Connect your fulfillment sheet' }).waitFor();
    assert((await workspace()).shopDomain === 'test-store.myshopify.com', 'store address was not normalised and saved');
    await sp.getByLabel('Fulfillment sheet link').fill('not a link');
    await sp.getByRole('button', { name: /Sheet connected, continue/ }).click();
    await sp.getByRole('alert').filter({ hasText: 'https://docs.google.com/spreadsheets/d/' }).waitFor();
    await sp.getByLabel('Fulfillment sheet link').fill('https://docs.google.com/spreadsheets/d/abc123_-XYZ/edit');
    await sp.getByText('The 12 column headers the sheet needs').click();
    await sp.evaluate(() => window.scrollTo(0, 0));
    await shot('14-setup-sheet.png', sp);
    await sp.getByRole('button', { name: /Sheet connected, continue/ }).click();
    await sp.getByRole('heading', { name: 'Check and go live' }).waitFor();
    await sp.getByText('test-store.myshopify.com').waitFor();
    await sp.evaluate(() => window.scrollTo(0, 0));
    await shot('15-setup-confirm.png', sp);
    await sp.getByRole('button', { name: 'Go live' }).click();
    await sp.waitForURL('**/today');
    const ws = await workspace();
    assert(ws.status === 'live' && ws.sheetUrl.endsWith('abc123_-XYZ/edit'), `status ${ws.status}`);
    await sp.close();
    return 'saved, normalised, live';
  });

  await check('L4', 'Setup on a live workspace is a read-only walkthrough', async () => {
    const before = await workspace();
    const sp = await desktop.newPage();
    await sp.goto(`${BASE}/setup?customer=${CUSTOMER}`);
    await sp.getByText('Your workspace is already live').waitFor();
    await sp.getByLabel('Store address').fill('other-store.myshopify.com');
    await sp.getByRole('button', { name: /Store connected, continue/ }).click();
    await sp.waitForURL(/step=sheet/);
    const after = await workspace();
    assert(after.shopDomain === before.shopDomain && after.sheetUrl === before.sheetUrl, 'walkthrough changed the workspace');
    await sp.goto(`${BASE}/setup?step=confirm&customer=${CUSTOMER}`);
    await sp.getByRole('button', { name: 'Back to Today' }).click();
    await sp.waitForURL('**/today');
    await sp.close();
  });

  await check('L5', 'Setup usable at 360 px on every step', async () => {
    const mobile = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const mp = await mobile.newPage();
    for (const step of ['store', 'sheet', 'confirm']) await noHScroll(mp, `/setup?step=${step}&customer=${CUSTOMER}`);
    await mp.goto(`${BASE}/setup?step=store&customer=${CUSTOMER}`);
    await shot('16-setup-mobile.png', mp);
    await mobile.close();
  });

  await check('L6', 'Landing and Setup have no obvious accessibility misses (names, landmarks, contrast tokens in use)', async () => {
    const ap = await desktop.newPage();
    for (const route of ['/welcome', '/setup']) {
      await ap.goto(`${BASE}${route}?customer=${CUSTOMER}`);
      await ap.locator('h1').waitFor();
      const r = await ap.evaluate(() => ({
        main: document.querySelectorAll('main').length,
        unnamed: [...document.querySelectorAll('a,button')].filter((e) => !(e.textContent || '').trim() && !e.getAttribute('aria-label')).length,
        imgNoAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
        lang: document.documentElement.lang,
      }));
      assert(r.main === 1 && r.unnamed === 0 && r.imgNoAlt === 0 && r.lang === 'en', `${route}: ${JSON.stringify(r)}`);
    }
    await ap.close();
  });

  await check('L7', 'Landing story: 10 headed slides, keys step through them, the Today toggle flips, reduced motion shows everything', async () => {
    const sp = await desktop.newPage();
    await sp.goto(`${BASE}/welcome?customer=${CUSTOMER}`);
    await sp.locator('h1').waitFor();
    const shape = await sp.evaluate(() => {
      const sections = [...document.querySelectorAll('main section')];
      return { n: sections.length, unheaded: sections.filter((s) => !document.getElementById(s.getAttribute('aria-labelledby'))).length };
    });
    assert(shape.n === 10 && shape.unheaded === 0, `slides: ${JSON.stringify(shape)}`);

    const current = () => sp.evaluate(() => Number(document.querySelector('nav[aria-label="Story chapters"] [aria-current="step"]')?.getAttribute('aria-label').split(' ')[0]) - 1);
    assert(await current() === 0, 'story should start on slide 1');
    await sp.keyboard.press('ArrowDown');
    await sp.waitForFunction(() => document.querySelector('nav[aria-label="Story chapters"] [aria-current="step"]')?.getAttribute('aria-label').startsWith('2 of'));
    await sp.keyboard.press('Space');
    await sp.waitForFunction(() => document.querySelector('nav[aria-label="Story chapters"] [aria-current="step"]')?.getAttribute('aria-label').startsWith('3 of'));
    await sp.keyboard.press('End');
    await sp.waitForFunction(() => document.querySelector('nav[aria-label="Story chapters"] [aria-current="step"]')?.getAttribute('aria-label').startsWith('10 of'));

    await sp.locator('#today').scrollIntoViewIfNeeded();
    const verdict = sp.locator('#today [role=status]');
    await verdict.filter({ hasText: 'All orders are moving' }).waitFor();
    await sp.getByRole('button', { name: 'Something broke' }).click();
    await verdict.filter({ hasText: '1 order needs attention' }).waitFor();
    await sp.close();

    const calm = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const cp = await calm.newPage();
    await cp.goto(`${BASE}/welcome?customer=${CUSTOMER}`);
    await cp.locator('h1').waitFor();
    const hidden = await cp.evaluate(() => [...document.querySelectorAll('.reveal')].filter((e) => getComputedStyle(e).opacity !== '1').length);
    assert(hidden === 0, `${hidden} reveal elements hidden under reduced motion`);
    await calm.close();
    return '10 slides, keys, toggle, reduced motion';
  });
} finally {
  await browser.close();
  server.kill();
  mock.close();
  // Leave the demo workspace clean and realistic.
  await reset('connecting');
  for (const b of happy()) {
    await fetch(`${UNCONFIGURED_BASE}/api/sync-events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-callback-secret': SECRET }, body: JSON.stringify(b),
    }).catch(() => {});
  }
  await mongo.close();
}

const stamp = new Date().toISOString();
const lines = [
  '# Navigation test results (N1–N7 + extras)',
  '',
  `Run ${stamp} by \`app/e2e/run.mjs\` against the real server and MongoDB, headless local Chrome. Screenshots: \`evidence/screenshots/app/\`.`,
  'N7 uses a mock Fastn embed endpoint because the real widget\'s expiry message is still an open question.',
  '',
  '| # | Check | Result | Notes |',
  '|---|---|---|---|',
  ...results.map((r) => `| ${r.id} | ${r.name} | ${r.pass ? '✅ pass' : '❌ fail'} | ${r.note.replace(/\|/g, '\\|')} |`),
  '',
];
fs.writeFileSync(path.join(repo, 'evidence/nav-test-results.md'), lines.join('\n'));
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed. Report: evidence/nav-test-results.md`);
process.exit(failed ? 1 : 0);
