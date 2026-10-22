# Atlas cleanup and consumer migration

Inventory date: 2026-10-22.

Preserve public imports in the form `@wess/atlas/<package>`. Make Atlas selectively
installable, reduce unnecessary loading and resource usage, and migrate consumers
individually without forcing the portfolio onto a new release at once.

Every Atlas-based application must consume Atlas as a versioned library through
public `@wess/atlas/<package>` imports. Application installs, builds, tests, and
deployments must work without a local Atlas checkout or machine-specific links.
This applies to all inventoried applications and downstream sites, including their
build scripts, CI configuration, and deployment images.

This inventory reflects local manifests and source imports under `~/Desktop/Dev`.
Production deployment status is partly verified. The inventory below records
original dependency declarations; it is not a claim about deployed versions.

## Current validation and release status

The modular **0.4.4 release is published** with all 22 library artifacts and its
integrity catalog. All 11 direct applications use it in their local working trees,
with frozen GitHub installs, typechecks, and the shipped CLI guard passing.
Isolated 0.4.3 application suites passed; 0.4.4 changes dependency closure and the
CLI guard, with a new isolated production UI render gate. Inkling's actual 0.4.4
PostgreSQL suite also passes all 397 cases.
Original files and lockfiles are retained in the private migration backup recorded
by the local migration receipt. The 0.4.7 candidate preserves native credential
backends and Linux entry names after the keyring upgrade. Old/new macOS credential
interoperability passed with a disposable test entry; Linux and Windows checks
must pass before this candidate is released or native clients advance to it.
Distribution stays in `wess/atlas`; no npm token or local Atlas checkout is required.
Production has only been inspected read-only; no application deployment has changed.

- Atlas emits 22 coordinated artifacts: the public facade and 21 backing libraries.
  Server-only packed installs work with an unreachable npm registry and without React
  or Zod. Real HTTP tarball installs and CLI startup also pass. Artifact SHA-512
  checks are enforced; the release workflow verifies every uploaded file before
  publishing its draft, resumes partial drafts, and refuses to replace existing bytes.
  Two independent builds produce identical catalogs and tarball hashes.
- All 11 app candidates installed, typechecked, and audited with upgraded direct
  dependencies. All audits returned zero reported vulnerabilities. Local candidate
  suites were rerun with the final storage artifacts. Billing needed isolated test
  modules and fixture cleanup; its corrected suite passed repeatedly against a
  fresh local database and also passed on its original pinned Atlas dependency.
- All ten templates, three custom variants, and the example passed independent
  packed installs and typechecks. Live checks cover HTTP startup, SQLite, example
  signup/login/post persistence, and admin API access for anonymous/user/admin roles.
  The fixture verifier is now required in CI and release workflows.
- Pluck's Sharp security update is applied to its working tree and lockfile. Other
  compatibility fixes and modular library migrations are applied to the 11 direct
  app working trees; downstream site and native-client updates remain in progress.
- Web dependency audit reports no vulnerabilities or outdated packages. Desktop
  `cargo audit` reports zero vulnerabilities but 13 unmaintained dependency warnings
  (including duplicate versions). These are unresolved maintenance risks, not a
  clean maintenance audit. Direct desktop dependencies match current stable releases;
  `cargo update --dry-run` reports zero compatible updates.
- A real local 100 MiB HTTP upload benchmark reduced peak RSS from 249,462,784 to
  45,187,072 bytes (about 82%) by hashing incrementally and spooling one-shot streams
  to private temporary files. Request duration increased from 142 to 153 ms in that
  single comparison. This is not a production throughput or fleet-wide memory result;
  measure concurrent uploads, disk use, and production-like latency before rollout.
- Four concurrent 64 MiB uploads to a local HTTP receiver completed with valid
  payload digests. The previous buffering implementation peaked at 1,061,978,112
  bytes RSS; the packed candidate peaked at 110,706,688 bytes (about 90% less).
  Total time was 582 ms versus 495 ms. These local results include the receiver
  in the same process and do not replace production latency or capacity testing.
- A three-trial local HTTP comparison (32 concurrent clients, 20,000 measured
  requests after warmup per trial) produced median throughput of 57,709 versus
  57,688 requests/sec and p95 latency of 0.809 versus 0.841 ms. Median startup
  was 12.62 versus 12.89 ms. This small server fixture shows similar performance;
  it does not establish fleet-wide resource or latency changes.
- Clean production installs use `bun install --production --omit=peer --frozen-lockfile`.
  Selected module closures and external peers are explicit application dependencies.
  The plain `--production` test retained the development CLI through optional peers;
  a fresh `--omit=peer` install contains only the three selected runtime libraries.
- S3 signatures for reserved and Unicode keys match an independent Smithy signer.
  All 40 storage tests pass against a private, disposable RustFS 1.0.3 server.
  Packed-library checks also pass for streamed uploads, exact keys, signed range
  downloads, and multipart upload/download integrity. Anonymous access and invalid
  signatures are rejected. The native server archive is SHA-256 checked; CI and
  release workflows now require this gate without depending on Docker.
- Atlas's full suite passes 672 tests; its five S3 integration cases are additionally
  run by the service gate above. Source typechecks, formatting checks, and workflow
  lint pass. Existing lint warnings remain and are not represented as resolved.
- Cubeplane, Bypath, Pluck, and StandingHere's browser builds pass with the upgraded
  dependencies. This does not establish production browser behavior or performance.
- All six available Inkling client sites install, typecheck, and audit cleanly
  against a packed Inkling candidate using the new Atlas libraries. Available site
  suites pass: Schorror 5, Apothecary 16, Warren 48. These are staged migrations;
  actual sites retain their existing pins pending release and rollout validation.

| Candidate application | Passing tests | Skipped tests |
| --- | ---: | ---: |
| Cubeplane | 49 | 0 |
| OpenVendor | 22 | 0 |
| Billing | 6 | 0 |
| Lacey Recipes | 4 | 0 |
| Klatch | 59 | 0 |
| Bypath | 129 | 0 |
| Pluck | 268 | 0 |
| StandingHere | 144 | 0 |
| Stohr | 489 | 0 |
| Inkling | 397 | 0 |
| Corsair | 614 + 3 provider-enabled cases | complementary cases in each provider mode |

Reproduce local Atlas release checks from `web/`:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run check
bun test
bun run distribution:build
bun run distribution:verify
bun run fixtures:verify out/distribution /tmp/atlasfixtures
bun run storage:verify /path/to/verified/rustfs out/distribution
bun run distribution:dryrun
bun audit
```

The consumer verifier stages secret-free copies outside the portfolio and tests
packed candidates. `bun run consumers:verify out/distribution /tmp/atlaslatest --upgrade`
performs install/update/typecheck/audit; app test suites additionally require the
explicit isolated test database configuration. Never point destructive test suites
at application or production databases.

Downstream candidate validation is available through
`bun validation/fleet.ts out/distribution /tmp/atlaslatest/inkling ~/Desktop/clients /tmp/atlasfleet`.
It prepares a next-release Inkling migration; its proposed `v1.24.0` tag is not
published. Both the disposable PostgreSQL cluster and RustFS process were stopped
after verification.

## Consumer inventory

There are **11 direct consumer applications**. Module lists describe direct source
imports, not the complete transitive dependency graph. An unversioned manifest ref
can still resolve to a specific commit in its lockfile.

| Application | Manifest | Atlas dependency today | Modules directly used |
| --- | --- | --- | --- |
| Klatch | [klatch/web/package.json](../klatch/web/package.json) | `@wess/atlas`: `github:wess/atlas#v0.3.0` | server, db, migrate, billing, storage, ai, mcp |
| Billing | [billing/package.json](../billing/package.json) | `@wess/atlas`: `github:wess/atlas` | server, auth, db, security |
| Lacey Recipes | [lacey/recipes/web/package.json](../lacey/recipes/web/package.json) | `@wess/atlas`: `github:wess/atlas`; `@atlas/social`: `file:vendor/social.tgz` | server, auth, email, ai, social |
| OpenVendor | [openvendor/package.json](../openvendor/package.json) | `@wess/atlas`: `link:@wess/atlas` | server, auth, db, migrate, security, config, storage, billing, email |
| Bypath | [bypath/web/package.json](../bypath/web/package.json) | `atlas`: `github:wess/atlas#v0.3.0` | server, auth, db, migrate, security, config, billing, email |
| Stohr | [stohr/package.json](../stohr/package.json) | `atlas`: `github:wess/atlas#v0.3.2` | server, auth, db, migrate, config, storage, sso, cli |
| Pluck | [pluck/web/package.json](../pluck/web/package.json) | `atlas`: `github:wess/atlas#v0.3.0`; postinstall billing patch | server, auth, db, migrate, security, config, storage, billing, email, share |
| StandingHere | [standinghere/web/package.json](../standinghere/web/package.json) | `atlas`: `github:wess/atlas#v0.3.0` | server, auth, db, migrate, security, config, storage, email |
| Inkling | [inkling/package.json](../inkling/package.json) | `atlas`: `github:wess/atlas#v0.3.0` | server, auth, db, security, config, storage, ai |
| Corsair | [corsair/package.json](../corsair/package.json) | `atlas`: `github:wess/atlas#v0.3.0` | server, auth, db, migrate, security, config, storage |
| Cubeplane | [cubeplane/web/package.json](../cubeplane/web/package.json) | `@wess/atlas`: `file:../../atlas` | ui/provider, ui/nav |

OpenVendor's installed Atlas resolves directly to this Atlas working tree. Local
Atlas changes already affect it. Cubeplane declares a local file dependency; do not
assume that its installed copy updates automatically.

Atlas's example application, documentation site, and templates are additional
release fixtures. Inkling has downstream client sites outside the requested Dev
directory; its locally identified fleet is listed below. Native clients consuming these
applications' APIs need compatibility checks even without direct Atlas imports.

| Downstream Inkling site | Local source under `~/Desktop/clients` | Local Inkling pin |
| --- | --- | --- |
| Undercover | `undercover` | 1.23.2 |
| Schorror | `schorror` | 1.15.1 |
| Apothecary | `apothecary` | 1.15.1; also imports Atlas through undeclared transitive dependencies |
| 803media | `803media` | 1.15.1 |
| School | `inkling-site` | 1.22.0 |
| Warren | `warrenpublishing` | 1.22.0; also directly consumes Atlas 0.3.0 |
| AAA | retired archive under `~/Desktop/backups/aaa-retired-2026-10-09/` | retired; excluded from rollout |

- [ ] Validate each downstream site against the new Inkling and Atlas releases.
- [x] Account for AAA before fleet completion: retired on 2026-10-09 per
  `devops/docs/hosts/gohan.md`; its archive is under `~/Desktop/backups/aaa-retired-2026-10-09/`.
  On 2026-10-22 its live URL returned HTTP 301 to `https://wess.dev/`, and no AAA
  container was running on gohan. Retained databases and archives are not rollout targets.

## Proposed public module layout

Existing entry points remain canonical; narrower entry points below are proposed
where needed to isolate dependencies. Validate the boundaries before implementation.

| Area | Public imports |
| --- | --- |
| HTTP | `@wess/atlas/server`, `/server/ws`, `/server/sse` |
| Authentication | `/auth`, `/auth/password`, `/auth/token`, `/auth/session`, `/auth/flows`, `/auth/social` |
| Security and identity | `/security`, `/oauth`, `/sso` |
| Data | `/db`, `/db/query`, `/db/postgres`, `/db/sqlite`, `/db/changeset`, `/migrate` |
| Infrastructure | `/config`, `/cache`, `/storage`, `/storage/signing`, `/email`, `/request`, `/request/providers`, `/edge` |
| Product features | `/billing`, `/social`, `/share`, `/ai`, `/mcp` |
| Frontend | `/ui/provider`, `/ui/nav`, `/ui/forms`, `/ui/table`, and individual remaining blocks |
| Administration | `/admin` for server routes; `/admin/ui` for browser components |
| Tooling | `/cli`, with scaffolding and documentation isolated from application runtime imports |

All shortened paths in the table use the `@wess/atlas` prefix.

Atlas already has substantial module separation. Moving directories alone does not
reduce memory usage. Installation size, loaded code, browser bundles, startup cost,
and sustained memory consumption must be measured separately.

## 1. Baselines and release checkpoints

- [ ] Record each app's resolved Atlas commit, lockfile, runtime/toolchain versions,
  selected modules, checks, and current deployment artifact.
- [ ] Verify deployment status and the established deployment and rollback process
  for every app before selecting production canaries.
- [ ] Capture installed dependency size, browser bundle size where applicable,
  startup time, idle memory, and representative request latency and throughput.
- [ ] Measure memory under sustained traffic, concurrent streams, and slow clients.
- [ ] Review the existing dependency/security audit changes as a release checkpoint;
  distinguish their behavior changes from packaging changes during validation.
- [ ] Keep existing pinned applications on their current release until their
  individual migrations pass.

## 2. Selective distribution and module boundaries

- [x] Prototype a thin `@wess/atlas` facade over separately distributable
  implementation modules while preserving `@wess/atlas/<package>` imports.
- [x] Use valid backing package names, such as `@wess/atlas-server`; subpath imports
  are not independent package names.
- [x] Coordinate implementation versions and avoid duplicate shared module instances.
- [x] Install only selected modules and their required dependency closure. Validate
  Bun's peer dependency behavior rather than assuming optional peers save installs.
- [x] Test real packed artifacts in a clean consumer outside the Atlas workspace.
- [x] Ensure unused or missing optional modules do not break unrelated imports.
- [x] Keep password hashing, tokens, and session primitives independent of database
  flows and unused social providers.
- [x] Separate query/schema code, database drivers, and changeset validation so
  consumers do not load unused drivers or Zod unnecessarily.
- [x] Keep server modules independent of React, Mantine, and browser-only code.
- [x] Keep individual UI blocks independent of unrelated blocks and table/form peers.
  An isolated production provider render verifies required Mantine/React peers are
  explicit and form, table, database, and Zod packages remain absent.
- [x] Preserve `/admin` and `/admin/ui` separation in both imports and dependencies.
- [x] Separate CLI argument parsing and process management from scaffolding and docs.
  Stohr uses CLI functionality at runtime, so those APIs must remain available.
- [x] Update CLI installers, scaffolds, templates, public docs, and package manifests
  to use the selected-module setup consistently.

## 3. Remove consumer-specific workarounds

- [x] Migrate every direct Atlas-based app to released, versioned library dependencies.
  Remove Atlas `file:`, `link:`, cross-repository `workspace:` references, local
  tarballs, symlinks, and relative or absolute imports into an Atlas checkout.
  Atlas's own internal workspace dependencies remain an implementation detail.
- [x] Convert legacy `atlas/*` and `@atlas/*` imports to `@wess/atlas/*`.
- [x] Remove TypeScript aliases into `node_modules/atlas/web/packages` and other
  installation-layout assumptions after public export resolution passes.
- [x] Replace Klatch's private MCP imports with public exports for `createContext`,
  `createMcpServer`, and `defineTool`.
- [x] Provide a public storage-signing export for Stohr's multipart uploads and
  Inkling's storage adapter before removing their private imports.
- [x] Add supported per-object upload ACL options for Inkling's public media uploads;
  preserve private defaults and avoid exposing a shared bucket through bucket policy.
- [x] Move Pluck's subscription-cancellation behavior into Atlas, including Stripe's
  `cancel_at` matching a subscription or item period end. Verify equivalence before
  deleting `web/scripts/patchbilling.ts` and its postinstall hook.
- [x] Replace Lacey Recipes' vendored social tarball with the released social module
  after access-rule and privacy checks pass.
- [x] Replace OpenVendor's global link and Cubeplane's local file dependency with
  reproducible release dependencies.
- [x] Regenerate each migrated app's lockfile against the versioned GitHub library release;
  remove local Atlas paths from manifests, lockfiles, build scripts, and deployment
  configuration. Install only the Atlas modules that app needs.
- [x] Replace unversioned GitHub refs with explicit release versions or immutable
  refs, and retain lockfiles for every app.
- [ ] Remove unused Atlas aliases and dependencies based on source usage and the
  verified transitive graph, not merely what appears in old configuration.

## 4. Compatibility, security, and performance gates

- [x] Install each application against actual packed release artifacts; do not rely
  on workspace resolution or local links masking missing exports or dependencies.
- [ ] Verify each migrated app with a clean, lockfile-based install of its released
  Atlas libraries in CI or a container without the Atlas source checkout mounted.
  Confirm its build, tests, and startup do not depend on local Atlas paths or links.
- [ ] Update runtime image install commands to use `--production --omit=peer` after
  recording the complete selected dependency closure. Build frontend assets with
  development tooling before creating the clean production dependency tree.
- [ ] Add a CI check that rejects local Atlas dependency paths and source-checkout
  aliases so applications cannot silently revert to filesystem dependencies.
- [ ] Run each application's typechecks, builds, and relevant isolated tests.
  Inspect test setup first: several suites wipe and recreate test databases.
- [ ] Verify sessions, password login, social callbacks, authorization, and logout.
- [ ] Verify admin authorization explicitly grants administrator access and ordinary
  authenticated users cannot access privileged routes.
- [ ] Exercise JWT expiry/not-before validation, OAuth state/PKCE, verified provider
  identity claims, SSO state binding, and logout replay protections where used.
- [ ] Preserve existing secrets, encrypted provider keys, cookie behavior, API
  contracts, persistent volumes, and data across packaging migrations.
- [ ] Verify checkout, Stripe Connect, subscription cancellation, invoices,
  webhook signatures/idempotency, and workers in isolated payment environments.
- [ ] Configure explicit upload limits where the hardened default would reject
  valid uploads; keep bounds deliberate rather than disabling limits globally.
- [ ] Verify large uploads/downloads, multipart transfers, range requests, and
  public/private signed storage access.
- [ ] Verify SSE, WebSockets, cancellation, bounded queues, and slow-client behavior.
- [ ] Check proxy trust, security headers, static-file access, and secret redaction
  in the actual application configuration.
- [ ] Verify native-client login and API behavior alongside browser flows.
- [ ] Compare startup, memory, bundles, latency, and throughput against baselines;
  report measured savings separately and investigate regressions before rollout.
- [ ] Run Atlas's own suite, example, documentation build, generated templates, and
  clean minimal/server/UI consumer checks as release gates.
- [ ] Retain an exact previous application artifact and lockfile for rollback;
  account for any database changes before claiming rollback is safe.

## 5. Consumer rollout

Advance one app at a time after its checks pass. Confirm operational status before
using any app as a production pilot.

| Wave | Applications | Required application-specific checks |
| --- | --- | --- |
| Pilot | Cubeplane | UI-only install, provider/nav resolution, frontend build, and admin-panel behavior; keep its Elixir backend independent of Atlas server modules. |
| Pilot | OpenVendor | Clean backend install in an isolated environment; Stripe Connect, checkout, first-owner access, email, and product delivery. |
| Next | Billing | Owner signup restrictions, invoice generation, recurring worker, payment integration, and PDF/email delivery. Small import count does not make financial behavior low risk. |
| Next | Lacey Recipes | SQLite persistence, stable provider-key encryption secret, recipe/photo privacy, social access rules, AI streaming, and iOS/Android login and PKCE handoff. |
| Then | Klatch | Publishing, provider integrations, billing, migrations, storage, AI, and MCP tools. |
| Then | Bypath | Existing agent/desktop protocol, token auth, two-node routing, HTTP/2 and gRPC trailers, WebSockets, SSE, TCP, and UDP tunnels. |
| Then | Pluck | Cancellation patch equivalence, checkout, invitations, custom domains, large uploads, video/range delivery, and signed download links. |
| Then | StandingHere | Owner/admin permissions, Apple form-post callback choreography, Google login, native clients, and realtime messaging. |
| Last | Stohr | Multipart/resumable uploads, streaming/ranges, galleries, MFA/passkeys, SSO, WebDAV, federation, S3-compatible endpoints, and runtime process management. |
| Last | Inkling | CMS/admin/delivery/media/plugin/realtime behavior, storage ACLs, and downstream site compatibility. Validate School as a canary, then roll out client instances individually. |
| Last | Corsair | SMTP, IMAP, POP3, JMAP, STARTTLS, webmail/admin access, queues/workers, mail storage integrity, and billing; use controlled mail-flow tests. |

- [ ] Complete Cubeplane pilot.
- [ ] Complete OpenVendor pilot.
- [ ] Migrate Billing.
- [ ] Migrate Lacey Recipes.
- [ ] Migrate Klatch.
- [ ] Migrate Bypath.
- [ ] Migrate Pluck.
- [ ] Migrate StandingHere.
- [ ] Migrate Stohr.
- [ ] Migrate Inkling and inventory/validate each downstream instance.
- [ ] Migrate Corsair.

## 6. Dependency cleanup and completion

- [ ] Audit each app's remaining direct and transitive dependencies against current
  stable releases and security advisories at migration time.
- [ ] Apply required API changes for stable dependency upgrades; resolve peer-version
  conflicts and duplicate frontend runtimes rather than forcing incompatible versions.
- [ ] Validate dependency upgrades as a distinct step from the Atlas packaging switch
  so failures have an identifiable cause.
- [ ] Remove obsolete vendored archives, install patches, aliases, and unused
  dependencies after replacements pass their checks.
- [ ] Record each app's selected modules, exact release, validation results,
  deployment outcome, rollback artifact, and measured resource/performance changes.
- [ ] Confirm all inventoried consumers and downstream Inkling sites are accounted
  for before removing exports or distribution paths they still rely on.
