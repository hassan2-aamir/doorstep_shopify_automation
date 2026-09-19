// Create the AWS side of Doorstep from nothing: deploy bucket, Elastic Beanstalk application, and a
// single-instance Node 22 environment with its variables. Safe to re-run: it does nothing to an
// environment that already exists (use deploy.mjs and set-env.mjs for that).
//
//   node provision.mjs --dry-run        read-only checks, prints what it would create
//   node provision.mjs                  create it (needs deploy/.env.production, see env.example)
//
// It does not create the two IAM roles Elastic Beanstalk needs; see "First-time IAM roles" in README.md.
import fs from 'node:fs';
import { buildBundle } from './bundle.mjs';
import { runSmoke } from './smoke.mjs';
import {
  aws, cfg, deployBucket, deployDir, describeEnv, die, envOptionSettings, envUrl, fileUrl, fixedEnv, log, parseArgs,
  readEnvFile, REQUIRED_ENV, step, whoami, writeTempJson,
} from './lib/common.mjs';
import path from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { flags } = parseArgs(process.argv.slice(2));
const dry = flags.has('dry-run');
const total = dry ? 5 : 8;

const who = whoami();
log(`AWS ${who.arn} (account ${who.account}), region ${cfg.region}${dry ? '   [dry run]' : ''}`);

step(1, total, 'IAM roles Elastic Beanstalk needs');
const roles = [
  ['instance profile', () => aws(['iam', 'get-instance-profile', '--instance-profile-name', cfg.instanceProfile], { allowFail: true })],
  ['service role', () => aws(['iam', 'get-role', '--role-name', cfg.serviceRole], { allowFail: true })],
];
for (const [label, probe] of roles) {
  const ok = probe() !== null;
  log(`  ${ok ? 'found  ' : 'MISSING'} ${label} ${label === 'service role' ? cfg.serviceRole : cfg.instanceProfile}`);
  if (!ok) die(`The ${label} does not exist. Create it first (README.md, "First-time IAM roles").`);
}

step(2, total, 'Existing environment');
const existing = describeEnv();
if (existing) {
  log(`  ${cfg.env} already exists (${existing.Status}, ${existing.Health}, ${envUrl(existing)}). Nothing to create.`);
  log('  To ship code: node deploy.mjs.   To change variables: node set-env.mjs.');
  process.exit(0);
}
log('  none: will create');

step(3, total, 'Platform');
const stacks = aws(['elasticbeanstalk', 'list-available-solution-stacks']).SolutionStacks ?? [];
const stack = stacks.find((s) => s.includes('Amazon Linux 2023') && s.includes('Node.js 22'));
if (!stack) die('No "Amazon Linux 2023 ... Node.js 22" platform is available in this region.');
log(`  ${stack}`);

const bucket = deployBucket(who.account);
const envFile = path.join(deployDir, '.env.production');
const vars = readEnvFile(envFile);
log(`  bucket ${bucket}; application ${cfg.app}; environment ${cfg.env} (${cfg.instanceType}, single instance)`);

if (dry) {
  log(`  variables file ${envFile}: ${vars ? `found (${Object.keys(vars).length} keys)` : 'NOT FOUND, copy env.example to .env.production and fill it in'}`);
  const missing = vars ? REQUIRED_ENV.filter((k) => !vars[k]) : REQUIRED_ENV;
  log(missing.length ? `  still needed: ${missing.join(', ')}` : '  all required variables present');
  log('\nDry run: nothing was created.');
  process.exit(0);
}

if (!vars) die(`Missing ${envFile}. Copy env.example to .env.production and fill it in.`);
const missing = REQUIRED_ENV.filter((k) => !vars[k]);
if (missing.length) die(`.env.production is missing: ${missing.join(', ')}`);

step(4, total, 'Deploy bucket and application');
if (aws(['s3api', 'head-bucket', '--bucket', bucket], { allowFail: true }) === null) {
  aws(['s3api', 'create-bucket', '--bucket', bucket, ...(cfg.region === 'us-east-1' ? [] : ['--create-bucket-configuration', `LocationConstraint=${cfg.region}`])]);
  aws(['s3api', 'put-public-access-block', '--bucket', bucket, '--public-access-block-configuration',
    'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'], { json: false });
  log(`  created private bucket ${bucket}`);
} else log(`  bucket ${bucket} exists`);
const apps = aws(['elasticbeanstalk', 'describe-applications', '--application-names', cfg.app], { allowFail: true });
if (!apps?.Applications?.length) {
  aws(['elasticbeanstalk', 'create-application', '--application-name', cfg.app, '--description', 'Doorstep: order-to-doorstep autopilot']);
  log(`  created application ${cfg.app}`);
} else log(`  application ${cfg.app} exists`);

step(5, total, 'Build and upload the first version');
const bundle = buildBundle({});
const key = `${cfg.app}/${bundle.versionLabel}.zip`;
aws(['s3', 'cp', bundle.file, `s3://${bucket}/${key}`, '--only-show-errors'], { json: false });
aws(['elasticbeanstalk', 'create-application-version', '--application-name', cfg.app, '--version-label', bundle.versionLabel,
  '--source-bundle', `S3Bucket=${bucket},S3Key=${key}`]);
fs.rmSync(bundle.file, { force: true });
log(`  ${bundle.versionLabel} (${(bundle.bytes / 1024).toFixed(0)} KB)`);

step(6, total, 'Create the environment');
const optionSettings = [
  { Namespace: 'aws:elasticbeanstalk:environment', OptionName: 'EnvironmentType', Value: 'SingleInstance' },
  { Namespace: 'aws:elasticbeanstalk:environment', OptionName: 'ServiceRole', Value: cfg.serviceRole },
  { Namespace: 'aws:autoscaling:launchconfiguration', OptionName: 'IamInstanceProfile', Value: cfg.instanceProfile },
  { Namespace: 'aws:autoscaling:launchconfiguration', OptionName: 'DisableIMDSv1', Value: 'true' },
  { Namespace: 'aws:ec2:instances', OptionName: 'InstanceTypes', Value: cfg.instanceType },
  { Namespace: 'aws:elasticbeanstalk:healthreporting:system', OptionName: 'SystemType', Value: 'enhanced' },
  { Namespace: 'aws:elasticbeanstalk:application', OptionName: 'Application Healthcheck URL', Value: cfg.healthPath },
  { Namespace: 'aws:elasticbeanstalk:command', OptionName: 'DeploymentPolicy', Value: 'AllAtOnce' },
  ...envOptionSettings({ ...vars, ...fixedEnv() }),
];
const tmp = writeTempJson('create-env-options.json', optionSettings);
try {
  aws([
    'elasticbeanstalk', 'create-environment', '--application-name', cfg.app, '--environment-name', cfg.env,
    '--cname-prefix', cfg.env, '--solution-stack-name', stack, '--version-label', bundle.versionLabel,
    '--option-settings', fileUrl(tmp),
  ]);
} finally {
  fs.rmSync(tmp, { force: true });
}
log(`  creating ${cfg.env}; this takes about 5 minutes`);

step(7, total, 'Wait until it is Ready');
const end = Date.now() + 20 * 60 * 1000;
let env;
let last = '';
while (Date.now() < end) {
  env = describeEnv();
  const line = `${env.Status} / ${env.Health}`;
  if (line !== last) { log(`  ${new Date().toLocaleTimeString()}  ${line}`); last = line; }
  if (env.Status === 'Ready') break;
  await sleep(15000);
}
if (env?.Status !== 'Ready') die('Timed out waiting for the environment.');

step(8, total, 'Smoke test');
const results = await runSmoke(envUrl(env), { callbackSecret: vars.CALLBACK_SECRET });
for (const r of results) log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.note ? ` (${r.note})` : ''}`);
log(`\nEnvironment URL: ${envUrl(env)}`);
log('Next: set the Fastn env config appBaseUrl to that URL (README.md, "Point Fastn at the deployment").');
if (results.some((r) => !r.pass)) process.exit(1);
