// Build the Elastic Beanstalk source bundle: the API at the zip root (package.json, src, scripts) and the
// built web app under web/dist, which is where the WEB_DIST env var points on the instance.
//
//   node bundle.mjs [--skip-web-build] [--label <version-label>]
//
// Elastic Beanstalk runs `npm install` and then `npm start` itself, so node_modules is never shipped.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildDir, die, gitInfo, log, parseArgs, repoRoot, stamp } from './lib/common.mjs';
import { createZip } from './lib/zip.mjs';

const serverDir = path.join(repoRoot, 'app/server');
const webDir = path.join(repoRoot, 'app/web');

// Anything matching these must never reach the bundle: local secrets, logs, dependencies, test fixtures.
const FORBIDDEN = [/(^|\/)\.env/, /\.log$/, /(^|\/)node_modules\//, /\.pem$/, /(^|\/)test\//];

function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

export function collectFiles() {
  const files = [];
  for (const name of ['package.json', 'package-lock.json']) files.push({ name, from: path.join(serverDir, name) });
  for (const dir of ['src', 'scripts']) for (const rel of walk(path.join(serverDir, dir))) files.push({ name: `${dir}/${rel}`, from: path.join(serverDir, dir, rel) });
  const dist = path.join(webDir, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('app/web/dist/index.html is missing: build the web app first');
  for (const rel of walk(dist)) files.push({ name: `web/dist/${rel}`, from: path.join(dist, rel) });
  const bad = files.filter((f) => FORBIDDEN.some((re) => re.test(f.name)));
  if (bad.length) throw new Error(`refusing to bundle: ${bad.map((f) => f.name).join(', ')}`);
  return files;
}

function buildWeb({ fresh }) {
  const shell = process.platform === 'win32'; // npm is npm.cmd on Windows
  const run = (args) => {
    const r = spawnSync('npm', args, { cwd: webDir, stdio: 'inherit', shell });
    if (r.status !== 0) throw new Error(`npm ${args.join(' ')} failed in app/web`);
  };
  if (fresh || !fs.existsSync(path.join(webDir, 'node_modules'))) run(['ci', '--no-audit', '--no-fund']);
  run(['run', 'build']);
}

export function buildBundle({ label, skipWebBuild = false, freshInstall = false } = {}) {
  const git = gitInfo();
  const versionLabel = label || `doorstep-${git.sha}${git.dirty ? '-dirty' : ''}-${stamp()}`;
  if (!skipWebBuild) buildWeb({ fresh: freshInstall });
  const files = collectFiles();
  const zip = createZip(files.map((f) => ({ name: f.name, data: fs.readFileSync(f.from) })));
  fs.mkdirSync(buildDir, { recursive: true });
  const file = path.join(buildDir, `${versionLabel}.zip`);
  fs.writeFileSync(file, zip);
  return {
    file,
    versionLabel,
    bytes: zip.length,
    sha256: crypto.createHash('sha256').update(zip).digest('hex'),
    count: files.length,
    names: files.map((f) => f.name),
    dirty: git.dirty,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { flags, values } = parseArgs(process.argv.slice(2));
  try {
    const b = buildBundle({ label: values.label, skipWebBuild: flags.has('skip-web-build'), freshInstall: flags.has('fresh') });
    log(`Bundle ${b.versionLabel}`);
    log(`  ${b.file}`);
    log(`  ${b.count} files, ${(b.bytes / 1024).toFixed(0)} KB, sha256 ${b.sha256.slice(0, 16)}…`);
    if (b.dirty) log('  Note: the working tree has uncommitted changes; the label ends in -dirty.');
  } catch (err) {
    die(err.message);
  }
}
