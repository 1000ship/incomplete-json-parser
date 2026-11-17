import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import * as release from './verify-release.mjs';

const here = dirname(fileURLToPath(import.meta.url));
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'npm-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, '.github/release');
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(here, '../../package.json'), join(root, 'package.json'));
  for (const file of ['manifest.json', 'incomplete-json-parser-2.0.0.tgz']) copyFileSync(join(here, file), join(dir, file));
  return { root, dir };
}
function editJson(file, edit) {
  const data = JSON.parse(readFileSync(file));
  edit(data);
  writeFileSync(file, JSON.stringify(data));
}

test('rejects tampered tarball bytes', (t) => {
  const { dir } = fixture(t);
  writeFileSync(join(dir, 'incomplete-json-parser-2.0.0.tgz'), 'tampered');
  assert.throws(() => release.verifyRelease(dir), /SHA256 mismatch/);
});
for (const [field, value, message] of [
  ['version', '2.0.1', /wrong package version/],
  ['name', 'other-package', /wrong package name/],
  ['repository', { type: 'git', url: 'git+https://github.com/other/repo.git' }, /wrong repository URL/],
]) {
  test(`rejects wrong root ${field}`, (t) => {
    const { root, dir } = fixture(t);
    editJson(join(root, 'package.json'), (pkg) => { pkg[field] = value; });
    assert.throws(() => release.verifyRelease(dir), message);
  });
}
for (const [field, value, message] of [
  ['version', '2.0.1', /wrong package version/],
  ['repository', { type: 'git', url: 'git+https://github.com/other/repo.git' }, /wrong repository URL/],
]) {
  test(`rejects wrong archive ${field} even with matching digests`, (t) => {
    const { root, dir } = fixture(t);
    const archive = join(dir, 'incomplete-json-parser-2.0.0.tgz');
    const unpack = join(root, 'unpack');
    mkdirSync(unpack);
    const extract = spawnSync('tar', ['-xzf', archive, '-C', unpack]);
    assert.equal(extract.status, 0);
    editJson(join(unpack, 'package/package.json'), (pkg) => { pkg[field] = value; });
    assert.equal(spawnSync('tar', ['-czf', archive, '-C', unpack, 'package']).status, 0);
    const bytes = readFileSync(archive);
    editJson(join(dir, 'manifest.json'), (m) => {
      m.sha256 = createHash('sha256').update(bytes).digest('hex');
      m.shasum = createHash('sha1').update(bytes).digest('hex');
      m.integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    });
    assert.throws(() => release.verifyRelease(dir), message);
  });
}

test('only admits the canonical main manual workflow and explicit mode', () => {
  assert.equal(typeof release.verifyContext, 'function', 'context admission is not implemented');
  const env = {
    GITHUB_REPOSITORY: '1000ship/incomplete-json-parser', GITHUB_REF: 'refs/heads/main',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_WORKFLOW_REF: '1000ship/incomplete-json-parser/.github/workflows/publish-npm.yml@refs/heads/main',
    GITHUB_SHA: 'a'.repeat(40), RELEASE_MODE: 'validate', RUNNER_ENVIRONMENT: 'github-hosted',
  };
  assert.doesNotThrow(() => release.verifyContext(env));
  assert.doesNotThrow(() => release.verifyContext({ ...env, RELEASE_MODE: 'publish' }));
  for (const [key, value] of Object.entries({
    GITHUB_REPOSITORY: 'other/repo', GITHUB_REF: 'refs/heads/other', GITHUB_EVENT_NAME: 'push',
    GITHUB_WORKFLOW_REF: '1000ship/incomplete-json-parser/.github/workflows/other.yml@refs/heads/main',
    GITHUB_SHA: '', RELEASE_MODE: '', RUNNER_ENVIRONMENT: 'self-hosted',
  })) assert.throws(() => release.verifyContext({ ...env, [key]: value }), undefined, key);
});

test('anonymous registry gate accepts only absence or exactly matching published metadata', async () => {
  assert.equal(typeof release.registryState, 'function', 'registry gate is not implemented');
  const manifest = release.verifyRelease();
  const pkg = JSON.parse(readFileSync(join(here, '../../package.json')));
  const metadata = { ...pkg, dist: { integrity: manifest.integrity, shasum: manifest.shasum } };
  const response = (status, data) => async (url, options) => {
    assert.equal(url, 'https://registry.npmjs.org/incomplete-json-parser/2.0.0');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers?.authorization, undefined);
    return { status, json: async () => data };
  };
  assert.equal(await release.registryState(manifest, response(404)), 'absent');
  assert.equal(await release.registryState(manifest, response(200, metadata)), 'present');
  await assert.rejects(release.registryState(manifest, response(200, { ...metadata, dist: { ...metadata.dist, integrity: 'sha512-other' } })), /published integrity mismatch/);
  await assert.rejects(release.registryState(manifest, response(200, { ...metadata, version: '2.0.1' })), /wrong package version/);
  await assert.rejects(release.registryState(manifest, response(500)), /registry HTTP 500/);
  await assert.rejects(release.registryState(manifest, async () => { throw new Error('network unknown'); }), /network unknown/);
});

const script = fileURLToPath(new URL('./verify-release.mjs', import.meta.url));
test('the committed release passes artifact validation', () => {
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Verified incomplete-json-parser@2\.0\.0/);
});
