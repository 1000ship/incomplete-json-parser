# Reviewed 2.0.0 release input

`../workflows/publish-npm.yml` is **workflow_dispatch only**. Select the `main`
branch. Its default `mode=validate` verifies the immutable tarball, runs admission
and fresh-consumer tests, reads the anonymous public registry and performs only
`npm publish --dry-run`. It cannot publish in validate mode. `mode=publish` is an
explicit, separate manual choice; there are no push, tag, release, scheduled or
reusable-workflow triggers.

## npm package-specific trusted publisher

Configure only the `incomplete-json-parser` package (not account-wide access):

| Setting | Required value |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `1000ship` |
| Repository | `incomplete-json-parser` |
| Workflow filename | `publish-npm.yml` (filename only) |
| Environment name | Leave empty; this job does not use a GitHub environment |
| Allowed actions | Explicitly allow **direct `npm publish`** |
| Dist-tag management | **Do not allow `npm dist-tag`** |

The always-allowed `npm stage publish` permission alone is insufficient: this
workflow intentionally uses direct publishing, not staging plus human 2FA
approval. Do not add npm tokens, `NODE_AUTH_TOKEN`, npm login, or a secret-based
fallback. The workflow uses npm's native GitHub OIDC exchange on a GitHub-hosted
Ubuntu runner, with job-scoped `contents: read` and `id-token: write`. Node
`24.13.1` and npm `11.8.0` are pinned (official minimums: Node 22.14.0 and npm
11.5.1). Official actions are pinned to commit SHAs verified through GitHub.
Checkout does not persist credentials; npm configuration is isolated, and no
package-manager cache is used.

Source: https://docs.npmjs.com/trusted-publishers/

Create/validate the trust configuration close to the intended first publish:
current npm documentation requires its first successful publish within **2
days**, otherwise the connection expires. npm does not test the connection when
saving it. A successful validate run or dry run does **not** prove OIDC publish
authorization. Changing a connection's fixed identity requires deleting and
recreating it; its account settings remain the release owner's responsibility.

## Artifact identity and scope

The publish command sends exactly the checked-in `incomplete-json-parser-2.0.0.tgz`,
never a rebuild or a newly packed working directory. `manifest.json` records its
SHA256, npm SHA1 and SHA512 integrity. Verification runs again immediately before
the single publish command. Keep the public-repository/public-package automatic
provenance behavior enabled; `repository.url` identifies this exact GitHub repo.

The prior reviewed tarball had SHA256
`dfd5e6bc981d5bbb8cb03909d1a6bb45b0168b18b77888c54faa5b034c7543d6`.
It lacked required repository metadata. The replacement adds only the `git`
repository descriptor to `package/package.json`; it is **not byte-identical** to
that old archive and must not use its old hashes. All 16 member names remain the
same; the other 15 member contents, including all 12 JavaScript/declaration
members in `dist/`, are byte-identical. No parser, dependency, lockfile, package
version or package engine requirement changed. The previous 231-test evidence
is reused for unchanged code, not presented as a new full-suite execution.

The anonymous registry gate accepts HTTP 404 as absent. If version 2.0.0 exists,
it must match package identity, repository, SHA512 integrity and SHA1 exactly;
then publishing is skipped. A mismatch or an uncertain/network response fails
closed. Publication is serialized, cancellation is disabled, and npm network
retries are disabled. Do not automatically rerun an uncertain publish: reconcile
the public registry first. A successful publish is followed by anonymous exact
integrity readback and a fresh public-registry consumer test. This does not grant
separate dist-tag management authority; `--tag latest` is part of direct publish.

## Focused validation

- `node .github/release/verify-release.mjs`: local archive/metadata/hash checks.
- `node --test .github/release/verify-release.test.mjs`: tamper, package/version/
  repository and GitHub admission rejection; synthetic registry boundary tests.
- `node .github/release/verify-release.mjs registry`: real anonymous registry read,
  returning `absent` or `present`, or failing closed.
- Fresh-install the fixed local archive with `npm install --ignore-scripts
  --no-audit --no-fund --package-lock=false`, copy `consumer.cjs` into that clean
  consumer directory, and run `node --test consumer.cjs` there.
- Copy `consumer.ts` alongside it and run the existing installed TypeScript
  compiler with `--noEmit --strict --target ES2020 --module commonjs
  --moduleResolution node consumer.ts`. This fixture is for the installed package,
  not the repository's own source compilation; no new compiler dependency is
  added. CI exercises runtime consumers; the focused type check was local.

Local validation does not simulate a successful GitHub-hosted job, npm OIDC
exchange, real publication or public fresh-install before the version exists.
The safe manual workflow run can be performed only after this source is integrated
on GitHub; npm account settings and actual publishing are separate operations.
