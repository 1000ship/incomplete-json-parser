import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const name = 'incomplete-json-parser';
const version = '2.0.0';
const repository = 'git+https://github.com/1000ship/incomplete-json-parser.git';
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

function checkPackage(pkg) {
  assert.equal(pkg.name, name, 'wrong package name');
  assert.equal(pkg.version, version, 'wrong package version');
  assert.equal(pkg.repository?.type, 'git', 'wrong repository type');
  assert.equal(pkg.repository?.url, repository, 'wrong repository URL');
  assert.equal(pkg.main, 'dist/index.js', 'wrong main entry');
  assert.equal(pkg.types, 'dist/index.d.ts', 'wrong types entry');
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0, 'unexpected production dependencies');
}

export function verifyRelease(directory = here) {
  const manifest = readJson(resolve(directory, 'manifest.json'));
  assert.equal(manifest.name, name, 'wrong manifest package');
  assert.equal(manifest.version, version, 'wrong manifest version');
  assert.equal(manifest.repository, repository, 'wrong manifest repository');
  assert.equal(manifest.tarball, `${name}-${version}.tgz`, 'wrong tarball filename');
  checkPackage(readJson(resolve(directory, '../../package.json')));
  const tarball = resolve(directory, manifest.tarball);
  const bytes = readFileSync(tarball);
  assert.match(manifest.sha256, /^[a-f0-9]{64}$/);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256, 'SHA256 mismatch');
  assert.equal(createHash('sha1').update(bytes).digest('hex'), manifest.shasum, 'SHA1 mismatch');
  assert.equal(`sha512-${createHash('sha512').update(bytes).digest('base64')}`, manifest.integrity, 'integrity mismatch');
  const pkg = JSON.parse(execFileSync('tar', ['-xOf', tarball, 'package/package.json'], { encoding: 'utf8' }));
  checkPackage(pkg);
  assert.deepEqual(pkg, readJson(resolve(directory, '../../package.json')), 'archive/source metadata mismatch');
  return manifest;
}

export async function registryState(manifest, fetcher = fetch) {
  const response = await fetcher(`https://registry.npmjs.org/${name}/${version}`, {
    redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { accept: 'application/json' },
  });
  if (response.status === 404) return 'absent';
  assert.equal(response.status, 200, `registry HTTP ${response.status}; stop without publishing/retrying`);
  const pkg = await response.json();
  checkPackage(pkg);
  assert.equal(pkg.dist?.integrity, manifest.integrity, 'published integrity mismatch; never republish');
  assert.equal(pkg.dist?.shasum, manifest.shasum, 'published shasum mismatch; never republish');
  return 'present';
}

export function verifyContext(env = process.env) {
  assert.equal(env.GITHUB_REPOSITORY, '1000ship/incomplete-json-parser', 'wrong GitHub repository');
  assert.equal(env.GITHUB_REF, 'refs/heads/main', 'only main is allowed');
  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch', 'manual dispatch only');
  assert.equal(env.GITHUB_WORKFLOW_REF, '1000ship/incomplete-json-parser/.github/workflows/publish-npm.yml@refs/heads/main', 'wrong workflow');
  assert.equal(env.RUNNER_ENVIRONMENT, 'github-hosted', 'GitHub-hosted runner required');
  assert.match(env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/, 'invalid commit SHA');
  assert.ok(['validate', 'publish'].includes(env.RELEASE_MODE), 'explicit validate/publish mode required');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.env.GITHUB_ACTIONS === 'true') verifyContext();
    assert.ok(process.argv.length <= 3 && (!process.argv[2] || process.argv[2] === 'registry'), 'unknown command');
    const manifest = verifyRelease();
    if (process.argv[2] === 'registry') console.log(await registryState(manifest));
    else console.log(`Verified ${manifest.name}@${manifest.version} SHA256 ${manifest.sha256}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
