// Change the environment variables (and secrets) of the running Elastic Beanstalk environment.
//
//   node set-env.mjs --list                          names, with values shown only for non-secret keys
//   node set-env.mjs --from-file .env.production     apply every KEY=VALUE in the file
//   node set-env.mjs CALLBACK_SECRET=abc FASTN_HOST=https://live.gcp.fastn.ai
//   node set-env.mjs --unset DEMO_CUSTOMER_ID
//
// Values travel to AWS through a temporary file, never on the command line, and are never printed.
// EB restarts the app to apply a change (about a minute), so callbacks in that window get a connection error.
import fs from 'node:fs';
import { aws, cfg, describeEnv, die, ENV_NS, envOptionSettings, fileUrl, log, parseArgs, readEnvFile, writeTempJson } from './lib/common.mjs';

const SAFE_TO_SHOW = new Set(['NODE_ENV', 'WEB_DIST', 'FASTN_HOST', 'FASTN_USER_LEVEL', 'DEMO_CUSTOMER_ID', 'PORT']);
const KEY_RE = /^[A-Z][A-Z0-9_]*$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { flags, values, positional } = parseArgs(process.argv.slice(2));
const env = describeEnv();
if (!env) die(`Environment ${cfg.env} not found in ${cfg.region}.`);

function currentVars() {
  const r = aws(['elasticbeanstalk', 'describe-configuration-settings', '--application-name', cfg.app, '--environment-name', cfg.env]);
  const opts = r.ConfigurationSettings?.[0]?.OptionSettings ?? [];
  return Object.fromEntries(opts.filter((o) => o.Namespace === ENV_NS).map((o) => [o.OptionName, o.Value]));
}

if (flags.has('list')) {
  const vars = currentVars();
  for (const k of Object.keys(vars).sort()) log(`  ${k.padEnd(20)} ${SAFE_TO_SHOW.has(k) ? vars[k] : '(set, hidden)'}`);
  process.exit(0);
}

const updates = {};
if (values['from-file']) {
  const file = readEnvFile(values['from-file']);
  if (!file) die(`File not found: ${values['from-file']}`);
  Object.assign(updates, file);
}
for (const p of positional) {
  const eq = p.indexOf('=');
  if (eq < 1) die(`Expected KEY=VALUE, got "${p.split('=')[0]}"`);
  updates[p.slice(0, eq)] = p.slice(eq + 1);
}
const bad = Object.keys(updates).filter((k) => !KEY_RE.test(k));
if (bad.length) die(`Not valid variable names (UPPER_SNAKE_CASE): ${bad.join(', ')}`);

const args = ['elasticbeanstalk', 'update-environment', '--environment-name', cfg.env];
let tmp;
if (Object.keys(updates).length) {
  tmp = writeTempJson('option-settings.json', envOptionSettings(updates));
  args.push('--option-settings', fileUrl(tmp));
}
if (values.unset) args.push('--options-to-remove', `Namespace=${ENV_NS},OptionName=${values.unset}`);
if (args.length === 4) die('Nothing to do. Use --list, --from-file, KEY=VALUE or --unset KEY.');

try {
  aws(args);
} finally {
  if (tmp) fs.rmSync(tmp, { force: true });
}
log(`Applying: ${[...Object.keys(updates), ...(values.unset ? [`-${values.unset}`] : [])].join(', ')}`);

const end = Date.now() + 10 * 60 * 1000;
while (Date.now() < end) {
  await sleep(8000);
  const e = describeEnv();
  if (e.Status === 'Ready') { log(`Done. Health: ${e.Health}. Run smoke.mjs to confirm.`); process.exit(0); }
}
die('Timed out waiting for the environment to finish updating.');
