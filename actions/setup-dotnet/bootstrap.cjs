'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const source = require('./source.json');
const FILES = ['setup-dotnet.cjs', 'sdk-versions.cjs'];

async function download(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, {redirect: 'error', signal: AbortSignal.timeout(45000)});
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`HTTP ${response.status} fetching the SDK setup payload.`);
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
}

async function run(manifest = source, fetchFile = download) {
  if (!/^[0-9a-f]{40}$/.test(manifest.ref || '') ||
      Object.keys(manifest.files || {}).sort().join(',') !== [...FILES].sort().join(',')) {
    throw new Error('The SDK payload must identify an immutable PowerForge source and its two runtime files.');
  }
  const temporary = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'evotec-sdk-action-'));
  try {
    for (const file of FILES) {
      const expected = manifest.files[file];
      if (!/^[0-9a-f]{64}$/.test(expected || '')) throw new Error(`Missing SHA-256 for ${file}.`);
      const url = `https://raw.githubusercontent.com/EvotecIT/PSPublishModule/${manifest.ref}/.github/actions/setup-dotnet/${file}`;
      const bytes = await fetchFile(url);
      if (crypto.createHash('sha256').update(bytes).digest('hex') !== expected) {
        throw new Error(`SDK setup payload SHA-256 verification failed: ${file}`);
      }
      fs.writeFileSync(path.join(temporary, file), bytes, {flag: 'wx'});
    }
    const engine = require(path.join(temporary, 'setup-dotnet.cjs'));
    if (typeof engine.main !== 'function') throw new Error('The verified SDK payload has no action entrypoint.');
    return await engine.main();
  } finally {
    fs.rmSync(temporary, {recursive: true, force: true});
  }
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = {run};
