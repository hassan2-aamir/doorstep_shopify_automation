import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const deployDir = path.resolve(here, '..');
export const repoRoot = path.resolve(deployDir, '..');
export const buildDir = path.join(deployDir, '.build');

// Every value can be overridden from the environment (DOORSTEP_*), so a second stack is one export away.
export const cfg = {
  region: process.env.DOORSTEP_REGION || 'us-east-1',
  app: process.env.DOORSTEP_EB_APP || 'doorstep',
  env: process.env.DOORSTEP_EB_ENV || 'doorstep-prod',
  instanceType: process.env.DOORSTEP_INSTANCE_TYPE || 't3.micro',
  instanceProfile: process.env.DOORSTEP_INSTANCE_PROFILE || 'aws-elasticbeanstalk-ec2-role',
  serviceRole: process.env.DOORSTEP_SERVICE_ROLE || 'aws-elasticbeanstalk-service-role',
  healthPath: '/api/health',
  // Where the built web app lands on the instance: EB unpacks the bundle into /var/app/current.
  webDist: '/var/app/current/web/dist',
};

export const log = (msg = '') => console.log(msg);
export const step = (n, total, msg) => console.log(`\n[${n}/${total}] ${msg}`);
export function die(msg, code = 1) {
  console.error(`\nERROR: ${msg}`);
  process.exit(code);
}

const VALUE_FLAGS = new Set(['label', 'rollback', 'from-file', 'unset', 'url', 'confirm']);

export function parseArgs(argv) {
  const flags = new Set();
  const values = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) values[a.slice(2, eq)] = a.slice(eq + 1);
      else if (VALUE_FLAGS.has(a.slice(2)) && argv[i + 1] && !argv[i + 1].startsWith('--')) values[a.slice(2)] = argv[++i];
      else flags.add(a.slice(2));
    } else positional.push(a);
  }
  return { flags, values, positional };
}

/** Run the AWS CLI. Returns parsed JSON when `json` is set. Error text is printed; arguments are not. */
export function aws(args, { json = true, allowFail = false, region = cfg.region } = {}) {
  const full = [...args, '--region', region, ...(json ? ['--output', 'json'] : [])];
  const r = spawnSync('aws', full, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) {
    die(r.error.code === 'ENOENT'
      ? 'The AWS CLI (v2) was not found on PATH. Install it from https://aws.amazon.com/cli/ and run `aws configure`.'
      : r.error.message);
  }
  if (r.status !== 0) {
    if (allowFail) return null;
    die(`aws ${args.slice(0, 2).join(' ')} failed:\n${(r.stderr || r.stdout).trim()}`);
  }
  if (!json) return r.stdout;
  return r.stdout.trim() ? JSON.parse(r.stdout) : {};
}

export function whoami() {
  const who = aws(['sts', 'get-caller-identity']);
  return { account: who.Account, arn: who.Arn };
}

export const deployBucket = (account) => process.env.DOORSTEP_BUCKET || `doorstep-deploy-${account}`;

export function describeEnv() {
  const r = aws(['elasticbeanstalk', 'describe-environments', '--application-name', cfg.app, '--environment-names', cfg.env, '--no-include-deleted']);
  return r.Environments?.[0] ?? null;
}

export const envUrl = (env) => (env?.CNAME ? `http://${env.CNAME}` : null);

/** Parse a KEY=VALUE file (comments and blank lines ignored, optional surrounding quotes stripped). */
export function readEnvFile(file) {
  if (!fs.existsSync(file)) return null;
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

export const ENV_NS = 'aws:elasticbeanstalk:application:environment';

/** Names only are ever printed: the values are secrets. */
export const REQUIRED_ENV = ['MONGODB_URI', 'CALLBACK_SECRET', 'FASTN_API_KEY', 'FASTN_HOST', 'DEMO_CUSTOMER_ID'];
export const fixedEnv = () => ({ NODE_ENV: 'production', WEB_DIST: cfg.webDist, FASTN_USER_LEVEL: 'true' });

export const envOptionSettings = (vars) =>
  Object.entries(vars).map(([OptionName, Value]) => ({ Namespace: ENV_NS, OptionName, Value }));

/** Write JSON for a `file://` argument into .build (git-ignored). Secrets never go on a command line. */
export function writeTempJson(name, value) {
  fs.mkdirSync(buildDir, { recursive: true });
  const file = path.join(buildDir, name);
  fs.writeFileSync(file, JSON.stringify(value), { mode: 0o600 });
  return file;
}
export const fileUrl = (file) => `file://${path.relative(process.cwd(), file).split(path.sep).join('/')}`;

export function gitInfo() {
  const run = (args) => spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  const sha = run(['rev-parse', '--short', 'HEAD']);
  const dirty = run(['status', '--porcelain']);
  return {
    sha: sha.status === 0 ? sha.stdout.trim() : 'nogit',
    dirty: dirty.status === 0 && dirty.stdout.trim().length > 0,
  };
}

export const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
