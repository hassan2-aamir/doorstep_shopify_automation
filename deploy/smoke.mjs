// Post-deploy checks against a running Doorstep. Read-only: nothing here writes an event or changes state.
//
//   node smoke.mjs [--url http://host] [--require-widget]
//
// Without --url the address comes from the Elastic Beanstalk environment. Set CALLBACK_SECRET in the
// environment to also prove the receiver accepts the real secret (it sends an INVALID body, so the request
// is rejected by validation and nothing is stored).
import { fileURLToPath } from 'node:url';
import { describeEnv, die, envUrl, log, parseArgs } from './lib/common.mjs';

async function get(url, init) {
  const started = Date.now();
  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000), ...init });
  const text = await res.text();
  return { res, text, ms: Date.now() - started };
}

export async function runSmoke(base, { callbackSecret = '' } = {}) {
  const results = [];
  const check = async (name, fn) => {
    try {
      const note = await fn();
      results.push({ name, pass: true, note: note ?? '' });
    } catch (err) {
      results.push({ name, pass: false, note: err.message });
    }
  };
  const need = (cond, msg) => { if (!cond) throw new Error(msg); };

  await check('API health answers 200 {ok:true}', async () => {
    const { res, text, ms } = await get(`${base}/api/health`);
    need(res.status === 200, `status ${res.status}`);
    need(JSON.parse(text).ok === true, `body ${text.slice(0, 80)}`);
    return `${ms} ms`;
  });

  let indexHtml = '';
  await check('The web app is served at / (not an API error page)', async () => {
    const { res, text } = await get(`${base}/`);
    need(res.status === 200, `status ${res.status}`);
    need(/<div id="root">/.test(text), 'no #root in the HTML: is WEB_DIST pointing at the built app?');
    indexHtml = text;
  });

  await check('Client-side routes fall back to the app (/welcome, /sync-health)', async () => {
    for (const p of ['/welcome', '/sync-health']) {
      const { res, text } = await get(`${base}${p}`);
      need(res.status === 200 && /<div id="root">/.test(text), `${p} -> ${res.status}`);
    }
  });

  await check('The built JavaScript and CSS assets load', async () => {
    const assets = [...indexHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    need(assets.length >= 2, `found ${assets.length} asset links in the HTML`);
    for (const a of assets) {
      const { res } = await get(`${base}${a}`);
      need(res.status === 200, `${a} -> ${res.status}`);
    }
    return `${assets.length} assets`;
  });

  await check('Unknown API route is a JSON 404', async () => {
    const { res, text } = await get(`${base}/api/nope`);
    need(res.status === 404 && JSON.parse(text).error?.code === 'NOT_FOUND', `status ${res.status}`);
  });

  await check('Callback without the secret is refused (401)', async () => {
    const { res } = await get(`${base}/api/sync-events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    need(res.status === 401, `status ${res.status}`);
  });

  await check('Callback with a wrong secret is refused (401)', async () => {
    const { res } = await get(`${base}/api/sync-events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-callback-secret': 'definitely-not-it' }, body: '{}',
    });
    need(res.status === 401, `status ${res.status}`);
  });

  if (callbackSecret) {
    await check('The real callback secret is accepted (an empty body then fails validation, 400)', async () => {
      const { res } = await get(`${base}/api/sync-events`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-callback-secret': callbackSecret }, body: '{}',
      });
      need(res.status === 400, `status ${res.status} (401 means the secret on the server differs from CALLBACK_SECRET here)`);
    });
  }

  await check('Security headers present, server does not advertise Express', async () => {
    const { res } = await get(`${base}/`);
    need(res.headers.get('content-security-policy'), 'no Content-Security-Policy');
    need(res.headers.get('x-content-type-options') === 'nosniff', 'no nosniff');
    need(!res.headers.get('x-powered-by'), 'x-powered-by is set');
  });

  await check('No Cross-Origin-Opener-Policy header (the Fastn sign-in popup needs window.opener)', async () => {
    const { res } = await get(`${base}/`);
    const coop = res.headers.get('cross-origin-opener-policy');
    need(!coop, `COOP is "${coop}": popups lose window.opener and land on about:blank (fixed in commit 36dac6d, so this build predates it)`);
  });

  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs(process.argv.slice(2));
  let base = values.url;
  if (!base) {
    const env = describeEnv();
    base = envUrl(env);
    if (!base) die('No environment found and no --url given.');
  }
  base = base.replace(/\/$/, '');
  log(`Smoke test: ${base}`);
  const results = await runSmoke(base, { callbackSecret: process.env.CALLBACK_SECRET || '' });
  for (const r of results) log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.note ? ` (${r.note})` : ''}`);
  const failed = results.filter((r) => !r.pass).length;
  log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}
