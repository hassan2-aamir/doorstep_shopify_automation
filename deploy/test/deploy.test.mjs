import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';
import { collectFiles } from '../bundle.mjs';
import { envOptionSettings, parseArgs, readEnvFile } from '../lib/common.mjs';
import { crc32, createZip } from '../lib/zip.mjs';

// Independent reader: walks the central directory and inflates, so a writer bug cannot hide behind itself.
function readZip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd >= 0, 'no end-of-central-directory record');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let i = 0; i < count; i += 1) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, 'bad central header');
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    const lnlen = buf.readUInt16LE(local + 26);
    const start = local + 30 + lnlen;
    const raw = buf.subarray(start, start + csize);
    const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
    assert.equal(data.length, usize, `${name}: size`);
    assert.equal(crc32(data), crc, `${name}: crc`);
    out[name] = data.toString('utf8');
    p += 46 + nlen;
  }
  return out;
}

test('zip round-trips names, contents and compression methods', () => {
  const entries = [
    { name: 'package.json', data: Buffer.from('{"a":1}') },
    { name: 'web/dist/index.html', data: Buffer.from('<div id="root"></div>'.repeat(200)) }, // compressible
    { name: 'src/naïve/ünï.js', data: Buffer.from('export const x = 1;\n') },
    { name: 'empty.txt', data: Buffer.alloc(0) },
  ];
  const read = readZip(createZip(entries));
  assert.deepEqual(Object.keys(read), entries.map((e) => e.name));
  for (const e of entries) assert.equal(read[e.name], e.data.toString('utf8'));
});

test('zip refuses backslash and absolute entry names', () => {
  assert.throws(() => createZip([{ name: 'web\\dist\\index.html', data: Buffer.from('x') }]), /bad zip entry name/);
  assert.throws(() => createZip([{ name: '/etc/passwd', data: Buffer.from('x') }]), /bad zip entry name/);
});

test('crc32 matches the published check value', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('bundle holds the server and built web app and never a secret, log, dependency or test', (t) => {
  let files;
  try { files = collectFiles(); } catch (err) { return t.skip(err.message); } // web app not built yet
  const names = files.map((f) => f.name);
  for (const must of ['package.json', 'package-lock.json', 'src/index.js', 'src/app.js', 'web/dist/index.html']) assert.ok(names.includes(must), `missing ${must}`);
  assert.ok(names.every((n) => !/(^|\/)\.env|node_modules|\.log$|(^|\/)test\//.test(n)), 'forbidden file in the bundle');
  assert.ok(names.every((n) => /^(package(-lock)?\.json|src\/|scripts\/|web\/dist\/)/.test(n)), 'unexpected top-level entry');
});

test('parseArgs separates flags, value flags and positionals', () => {
  const { flags, values, positional } = parseArgs(['--dry-run', '--label', 'v2', '--rollback=v1', 'KEY=VALUE', '--list']);
  assert.ok(flags.has('dry-run') && flags.has('list'));
  assert.equal(values.label, 'v2');
  assert.equal(values.rollback, 'v1');
  assert.deepEqual(positional, ['KEY=VALUE']);
});

test('readEnvFile handles comments, quotes, blank lines and CRLF; ignores lowercase names', () => {
  const file = path.join(os.tmpdir(), `doorstep-env-${process.pid}.txt`);
  fs.writeFileSync(file, '# comment\r\nA=1\r\n\r\nB="two words"\r\nC=\'x=y\'\r\nlower=nope\r\nD=\r\n');
  try {
    assert.deepEqual(readEnvFile(file), { A: '1', B: 'two words', C: 'x=y', D: '' });
  } finally {
    fs.rmSync(file, { force: true });
  }
  assert.equal(readEnvFile(path.join(os.tmpdir(), 'does-not-exist.env')), null);
});

test('env option settings use the Elastic Beanstalk environment namespace', () => {
  assert.deepEqual(envOptionSettings({ A: '1' }), [{ Namespace: 'aws:elasticbeanstalk:application:environment', OptionName: 'A', Value: '1' }]);
});
