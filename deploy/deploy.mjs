// Ship the current working tree to the running Elastic Beanstalk environment.
//
//   node deploy.mjs                       build, upload, deploy, wait, smoke-test
//   node deploy.mjs --dry-run             build the bundle and show the plan; changes nothing in AWS
//   node deploy.mjs --list                show application versions and which one is live
//   node deploy.mjs --rollback <label>    redeploy an earlier version
//   node deploy.mjs --skip-web-build      reuse app/web/dist as it is
//   node deploy.mjs --no-smoke            skip the post-deploy checks
//
// The environment's variables (secrets included) are NOT touched by a deploy; use set-env.mjs for those.
// The deployment policy is AllAtOnce, so the site is briefly unavailable while the new version starts.
// Callbacks that arrive in that window get a connection error, which Fastn treats as a failed callback
// and never as a failed run.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildBundle } from './bundle.mjs';
import { runSmoke } from './smoke.mjs';
import { aws, cfg, deployBucket, describeEnv, die, envUrl, log, parseArgs, step, whoami } from './lib/common.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function versions() {
  const r = aws(['elasticbeanstalk', 'describe-application-versions', '--application-name', cfg.app]);
  return (r.ApplicationVersions ?? []).sort((a, b) => new Date(b.DateCreated) - new Date(a.DateCreated));
}

function recentEvents(n = 8) {
  const r = aws(['elasticbeanstalk', 'describe-events', '--application-name', cfg.app, '--environment-name', cfg.env, '--max-records', String(n)]);
  return (r.Events ?? []).map((e) => `  ${e.EventDate} ${e.Severity}: ${e.Message}`).join('\n');
}

async function waitForVersion(label, timeoutMs = 15 * 60 * 1000) {
  const end = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < end) {
    const env = describeEnv();
    const line = `${env.Status} / ${env.Health} / ${env.VersionLabel}`;
    if (line !== last) { log(`  ${new Date().toLocaleTimeString()}  ${line}`); last = line; }
    if (env.Status === 'Ready' && env.VersionLabel === label) return env;
    await sleep(10000);
  }
  die(`Timed out waiting for ${label}. Recent events:\n${recentEvents()}`);
}

function assertEnvReady() {
  const env = describeEnv();
  if (!env) die(`Environment ${cfg.env} not found in ${cfg.region}. Create it first with: node provision.mjs`);
  if (env.Status !== 'Ready') die(`Environment is ${env.Status}, not Ready. Wait for the running update to finish.`);
  return env;
}

async function finish(env, label, { smoke }) {
  const done = await waitForVersion(label);
  if (done.Health === 'Red' || done.Health === 'Severe') {
    die(`Deployed, but health is ${done.Health}. Recent events:\n${recentEvents()}\nRoll back with: node deploy.mjs --rollback <previous-label>`);
  }
  if (!smoke) return;
  log('\nSmoke test');
  const results = await runSmoke(envUrl(done), { callbackSecret: process.env.CALLBACK_SECRET || '' });
  for (const r of results) log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.note ? ` (${r.note})` : ''}`);
  if (results.some((r) => !r.pass)) die('Smoke test failed. The new version is live; roll back with: node deploy.mjs --rollback <previous-label>');
}

const { flags, values } = parseArgs(process.argv.slice(2));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const who = whoami();
  log(`AWS ${who.arn} (account ${who.account}), region ${cfg.region}`);

  if (flags.has('list')) {
    const env = describeEnv();
    for (const v of versions()) log(`${v.VersionLabel === env?.VersionLabel ? '* ' : '  '}${v.VersionLabel}  ${v.DateCreated}`);
    log('\n* = live');
    process.exit(0);
  }

  if (values.rollback) {
    const env = assertEnvReady();
    if (!versions().some((v) => v.VersionLabel === values.rollback)) die(`No application version named ${values.rollback}. See: node deploy.mjs --list`);
    log(`Rolling back ${cfg.env}: ${env.VersionLabel} -> ${values.rollback}`);
    aws(['elasticbeanstalk', 'update-environment', '--environment-name', cfg.env, '--version-label', values.rollback]);
    await finish(env, values.rollback, { smoke: !flags.has('no-smoke') });
    log('\nRolled back.');
    process.exit(0);
  }

  const total = flags.has('dry-run') ? 2 : 6;
  step(1, total, 'Check the target environment');
  const env = assertEnvReady();
  log(`  ${cfg.app}/${cfg.env}: ${env.Status}, ${env.Health}, currently ${env.VersionLabel}`);

  step(2, total, 'Build the bundle');
  const bundle = buildBundle({ label: values.label, skipWebBuild: flags.has('skip-web-build') });
  log(`  ${bundle.versionLabel}: ${bundle.count} files, ${(bundle.bytes / 1024).toFixed(0)} KB`);
  if (bundle.dirty) log('  (uncommitted changes in the tree: the label carries -dirty)');

  if (flags.has('dry-run')) {
    log(`\nDry run: nothing was uploaded. Would deploy ${bundle.versionLabel} to ${envUrl(env)} (currently ${env.VersionLabel}).`);
    process.exit(0);
  }

  const bucket = deployBucket(who.account);
  const key = `${cfg.app}/${bundle.versionLabel}.zip`;

  step(3, total, `Upload to s3://${bucket}/${key}`);
  if (aws(['s3api', 'head-bucket', '--bucket', bucket], { allowFail: true }) === null) die(`Bucket ${bucket} is missing or not yours. Create it with: node provision.mjs`);
  aws(['s3', 'cp', bundle.file, `s3://${bucket}/${key}`, '--only-show-errors'], { json: false });

  step(4, total, 'Register the application version');
  aws([
    'elasticbeanstalk', 'create-application-version', '--application-name', cfg.app, '--version-label', bundle.versionLabel,
    '--source-bundle', `S3Bucket=${bucket},S3Key=${key}`, '--description', `sha256 ${bundle.sha256.slice(0, 16)}`,
  ]);

  step(5, total, `Deploy to ${cfg.env}`);
  aws(['elasticbeanstalk', 'update-environment', '--environment-name', cfg.env, '--version-label', bundle.versionLabel]);
  fs.rmSync(bundle.file, { force: true });

  step(6, total, 'Wait for it to go live, then smoke-test');
  await finish(env, bundle.versionLabel, { smoke: !flags.has('no-smoke') });
  log(`\nLive: ${envUrl(env)}  (version ${bundle.versionLabel}; previous ${env.VersionLabel})`);
  log(`Roll back with: node deploy.mjs --rollback ${env.VersionLabel}`);
}
