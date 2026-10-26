'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {run} = require('./bootstrap.cjs');

function fixture() {
  const files = {
    'setup-dotnet.cjs': Buffer.from('exports.main = async () => require("./sdk-versions.cjs").ready + "|" + process.env["INPUT_DOTNET-VERSION"];'),
    'sdk-versions.cjs': Buffer.from('exports.ready = "verified SDK engine";')
  };
  return {
    files,
    manifest: {ref: 'a'.repeat(40), files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, crypto.createHash('sha256').update(bytes).digest('hex')]))}
  };
}

test('verified payload receives SDK inputs and its temporary source is removed', async () => {
  const {files, manifest} = fixture();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-loader-test-'));
  const oldTemp = process.env.RUNNER_TEMP;
  const oldInput = process.env['INPUT_DOTNET-VERSION'];
  process.env.RUNNER_TEMP = directory;
  process.env['INPUT_DOTNET-VERSION'] = '10.0.403';
  const requests = [];
  try {
    const result = await run(manifest, async url => { requests.push(url); return files[path.basename(url)]; });
    assert.equal(result, 'verified SDK engine|10.0.403');
    assert.equal(requests.length, 2);
    assert.ok(requests.every(url => url.startsWith(`https://raw.githubusercontent.com/EvotecIT/PSPublishModule/${manifest.ref}/.github/actions/setup-dotnet/`)));
    assert.deepEqual(fs.readdirSync(directory), []);
  } finally {
    if (oldTemp === undefined) delete process.env.RUNNER_TEMP; else process.env.RUNNER_TEMP = oldTemp;
    if (oldInput === undefined) delete process.env['INPUT_DOTNET-VERSION']; else process.env['INPUT_DOTNET-VERSION'] = oldInput;
    fs.rmSync(directory, {recursive: true, force: true});
  }
});

test('a corrupted payload fails before loading the SDK engine and is cleaned', async () => {
  const {files, manifest} = fixture();
  manifest.files['sdk-versions.cjs'] = '0'.repeat(64);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-loader-corrupt-test-'));
  const oldTemp = process.env.RUNNER_TEMP;
  process.env.RUNNER_TEMP = directory;
  try {
    await assert.rejects(run(manifest, async url => files[path.basename(url)]), /SHA-256 verification failed/);
    assert.deepEqual(fs.readdirSync(directory), []);
  } finally {
    if (oldTemp === undefined) delete process.env.RUNNER_TEMP; else process.env.RUNNER_TEMP = oldTemp;
    fs.rmSync(directory, {recursive: true, force: true});
  }
});

test('mutable source refs and unexpected runtime files are refused before download', async () => {
  const {manifest} = fixture();
  let downloaded = false;
  const fetchFile = async () => { downloaded = true; return Buffer.from('unexpected'); };
  await assert.rejects(run({...manifest, ref: 'main'}, fetchFile), /immutable PowerForge source/);
  await assert.rejects(run({...manifest, files: {...manifest.files, '../extra.cjs': '0'.repeat(64)}}, fetchFile), /two runtime files/);
  assert.equal(downloaded, false);
});
