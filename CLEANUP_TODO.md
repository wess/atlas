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

The modular **[0.4.9 release](https://github.com/wess/atlas/releases/tag/v0.4.9) is
published** with 22 library artifacts and its integrity catalog. Independently
downloaded bytes match both the catalog and the tested candidate. All 11 direct
web applications now use the released libraries locally; frozen installs,
typechecks, and the shipped library guard pass. No neighboring Atlas checkout is
needed. Registry checks report no outdated web dependencies or known vulnerabilities.

Application suites pass **2,202 unique cases**. All 11 applications were also
checked in independent Linux containers. The final AI-using release checks pass
Lacey 13, Klatch 61, and Inkling 398 cases; Lacey also passes with production-only
dependencies and its unused Atlas database library absent. The other runtime
modules are byte-identical to the previously tested 0.4.7 sources; CLI scaffold
normalization and the image-aware AI modules have their separate final-release gates.

**[Inkling 1.23.4](https://github.com/wess/inkling/tree/v1.23.4) is tagged. All six
active client sites are deployed on it with Atlas 0.4.9 and Bun 1.4.4.** Health,
home, and admin endpoints pass. Source was staged from the deployed applications,
keeping unfinished local client work out of the rollout. Schorror, Apothecary, and
Warren also pass their 5, 16, and 48 available site cases. School retains all 45
lessons; its admin sign-in/dashboard and published lessons were checked in Chrome.
Warren's 590-title catalog search also works in Chrome. Its only homepage HTML
difference is the rebuilt JavaScript cache key; the other five-site comparisons
preserve public content. Configuration checksums and persisted media match their
backups. Warren's transient SQLite shared-memory timestamp changed as expected;
the database and WAL are unchanged, and its integrity check passes.

Fresh PostgreSQL/media backups are retained on the host and off-host, with exact
previous images tagged for rollback. Before rollout, the five non-School sites
booted against isolated copies of their deployed schemas and migration records,
without copying customer rows or credentials into the test databases. Their old
production images also boot after the updated schema is applied. Core migration
19 is additive. No content seeds or secret rotations were run.

Native Bypath and Pluck are pinned to Atlas's **v0.4.9 Git tag**. Their final
67 and 75 behavior cases pass after compatible Rust dependency updates, and all
workspace targets compile on macOS. A fresh downstream audit found five Bypath,
six Pluck, and five Corsair-front vulnerability reports in old lockfiles. Rustls
0.23.46, rustls-webpki 0.103.16, and current root certificates clear every report;
yanked yoke-derive 0.8.3 was replaced. Corsair's unmaintained PEM reader is removed.
Both GUI graphs retain 13 unmaintained transitive warnings, which remain tracked
separately from exploitable advisories. The native front passes 12 real TLS/body
integrity checks on macOS, Linux CI, and the exact static Linux artifact on mx.
Linux and Windows OS credential identity, UTF-16 interoperability, concurrent
settings replacement, macOS tests, and all three native templates pass in CI.
Old/new macOS credential interoperability used a disposable entry, then removed it.
A temporary native consumer also passes password login and typed API calls against
private instances of the exact production images: Bypath opens an agent WebSocket
and forwards a real HTTP request to the native local origin; Pluck streams a
4 MiB file, reads an anonymous HTTP range, creates/lists/deletes shares, and rejects
the logged-out session. No production users or credentials were used. Full GUI
and physical-device provider handoffs remain distinct from these API canaries.

All nine server-application production images build and boot without development
packages or a local Atlas checkout. Their browser assets load and private config
and dependency source are not exposed. Startup observations are roughly 1.6–3.0
seconds including Docker startup/probing, with early memory samples of 10–72 MiB;
these are observations, not sustained-load savings. The separate School production
image also passes its browser checks. Cubeplane's UI-only build keeps its Elixir
backend independent. Lacey was independently deployed to Atlas 0.4.9 during this
work. Billing, Klatch, both Bypath edges, Pluck, StandingHere and its three workers,
Stohr, and Corsair are now also deployed on Atlas 0.4.9 / Bun 1.4.4. All are healthy
with zero crash restarts or OOM events at verification. Existing Klatch and
StandingHere browser sessions still load their authenticated views. Public HTML
is unchanged except rebuilt CSS/JavaScript filenames in Bypath, Pluck, and Stohr.
Configuration hashes match pre-deployment backups. Cubeplane explicitly has no
production deployment yet; OpenVendor has no established target in its source.
Their local/Linux pilots are complete; no new public hosting was invented.

The release also fixes stale CLI scaffold versions. All ten templates select the
CLI's coordinated release, and source-catalog drift fails validation. Release checks
pass 684 source cases, 14 packed-install cases, all 15 generated fixtures, and the
private S3 service gate. A live storage-provider canary additionally passes Blob
and one-shot stream uploads, Unicode/reserved keys, signed downloads and ranges,
anonymous-access rejection, and removal of both disposable objects.

Original source and locks remain in the private migration backups and receipts.
Distribution stays in wess/atlas; no npm token or local source link is required.

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
  app working trees; downstream site and native-client library updates are applied.
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
- Atlas's released 0.4.9 suite passes 684 tests; its five S3 integration cases are additionally
  run by the service gate above. Source typechecks, formatting checks, and workflow
  lint pass. Existing lint warnings remain and are not represented as resolved.
- Cubeplane, Bypath, Pluck, and StandingHere's browser builds pass with the upgraded
  dependencies. This does not establish production browser behavior or performance.
- All six active Inkling client sites install, typecheck, and audit cleanly against
  the tagged Inkling release and published Atlas libraries. Their actual working
  trees are migrated. Deployed-source candidates pass the available site suites;
  all six production sites now pass the rollout checks recorded above.

| Candidate application | Passing tests | Skipped tests |
| --- | ---: | ---: |
| Cubeplane | 49 | 0 |
| OpenVendor | 22 | 0 |
| Billing | 6 | 0 |
| Lacey Recipes | 13 | 0 |
| Klatch | 61 | 0 |
| Bypath | 129 | 0 |
| Pluck | 268 | 0 |
| StandingHere | 144 + 6 social/privacy cases | complementary isolated database run |
| Stohr | 489 | 0 |
| Inkling | 398 | 0 |
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
It derives the Inkling tag from the candidate's manifest. The local disposable
PostgreSQL cluster and RustFS process were stopped after verification. A separate
private Linux test database and application containers are removed after validation.
The dedicated internal network, disposable image tags, and SSH forwards are also
removed; production databases, media, and retained rollback images are untouched.

## Consumer inventory

There are **11 direct consumer applications**. Module lists describe direct source
imports, not the complete transitive dependency graph. An unversioned manifest ref
can still resolve to a specific commit in its lockfile.

| Application | Manifest | Original Atlas declaration | Modules directly used |
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

Originally, OpenVendor's installed Atlas resolved to this working tree and
Cubeplane declared a local file dependency. Both now use pinned release libraries;
the table preserves their original declarations for the migration record.

Atlas's example application, documentation site, and templates are additional
release fixtures. Inkling has downstream client sites outside the requested Dev
directory; its locally identified fleet is listed below. Native clients consuming these
applications' APIs need compatibility checks even without direct Atlas imports.

| Downstream Inkling site | Local source under `~/Desktop/clients` | Original Inkling pin |
| --- | --- | --- |
| Undercover | `undercover` | 1.23.2 |
| Schorror | `schorror` | 1.15.1 |
| Apothecary | `apothecary` | 1.15.1; also imports Atlas through undeclared transitive dependencies |
| 803media | `803media` | 1.15.1 |
| School | `inkling-site` | 1.22.0 |
| Warren | `warrenpublishing` | 1.22.0; also directly consumes Atlas 0.3.0 |
| AAA | retired archive under `~/Desktop/backups/aaa-retired-2026-10-09/` | retired; excluded from rollout |

- [x] Validate each downstream site against the new Inkling and Atlas releases.
- [x] Account for AAA before fleet completion: retired on 2026-10-09 per
  `devops/docs/hosts/gohan.md`; its archive is under `~/Desktop/backups/aaa-retired-2026-10-09/`.
  On 2026-10-22 its live URL returned HTTP 301 to `https://wess.dev/`, and no AAA
  container was running on gohan. Retained databases and archives are not rollout targets.

## Verified local library selections

All rows use Atlas 0.4.9, source commit 14bbb84d462547a51a9fdfc97ba3ab61e20813f1,
with Bun 1.4.4. The module column lists backing libraries in the installed closure;
public imports remain @wess/atlas/<module>. Lock digests identify the checked local
snapshot. Production metadata was read from running containers/services, not inferred
from these manifests. Consumer releases and deployments were explicitly authorized. Stohr and Corsair
were isolated in release branches, checked through PRs, and merged; unrelated
working changes were kept out of deployment candidates.

| App | Selected backing libraries | Lock SHA-256 prefix | Live Atlas / runtime |
| --- | --- | --- | --- |
| cubeplane | ui | ca40e306e476 | not deployed; local/Linux pilot verified |
| openvendor | auth, billing, config, db, email, migrate, request, security, server, storage | ea3127b0bdfc | no established deployment target; local/Linux pilot verified |
| billing | auth, db, security, server | faa27e0b5ff8 | 0.4.9 / Bun 1.4.4 |
| lacey | ai, auth, email, server, social | 12872798f7d2 | 0.4.9 / Bun 1.4.4 (independent rollout) |
| klatch | ai, billing, cache, db, mcp, migrate, request, server, storage | 94b19f206bee | 0.4.9 / Bun 1.4.4 |
| bypath | auth, billing, config, db, email, migrate, request, security, server | b3f45636b6f7 | 0.4.9 / Bun 1.4.4 (both nodes) |
| pluck | auth, billing, config, db, email, migrate, request, security, server, share, storage | b0be036fcff3 | 0.4.9 / Bun 1.4.4 |
| standinghere | auth, config, db, email, migrate, security, server, storage | 43396faeca66 | 0.4.9 / Bun 1.4.4 (app + three workers) |
| stohr | auth, cli, config, db, migrate, server, sso, storage | 904550113de2 | 0.4.9 / Bun 1.4.4 |
| inkling | ai, auth, config, db, security, server, storage | 0a6ba37fb2b6 | 0.4.9 / Bun 1.4.4 (six sites) |
| corsair | auth, config, db, migrate, security, server, storage | f80c1025adaf | 0.4.9 / Bun 1.4.4 (systemd) |

Corsair's runtime was upgraded with its exact prior binary retained. Its mail and
TLS front were restarted after a fresh encrypted backup through the existing
backup unit, a clean production install, and a schema diff showing no pending
migrations. Both 25 and 587 pass verified TLS handshakes; all five mail listeners,
queue, database, DKIM checks, offsite backup, and webmail checks are healthy.
The immediate startup probe ran before listener readiness; the subsequent full
probe and certificate-verified handshakes pass. The prior source, dependency tree,
Bun binary, TLS binary, encrypted dumps, and environment archive are retained.

Production application releases: Billing 0.1.1, Klatch 0.1.6, Bypath web 0.1.1,
Pluck web 0.3.3, StandingHere 0.1.1, [Stohr 0.10.7](https://github.com/wess/stohr/releases/tag/v0.10.7),
and [Corsair 0.3.6](https://github.com/wess/corsair/releases/tag/v0.3.6).
Stohr PR 2 passes its full PostgreSQL CI suite; Corsair PR 2 passes its released
library and Linux TLS gates. Both are merged. Pluck's clean deployed-source build
exposed an obsolete COPY of its removed patch scripts; the Dockerfile no longer
requires that directory. Bypath's initial staging command failed on an unquoted
shell glob and rebuilt its old source. The corrected rollout verifies Atlas/Bun
inside the candidate image before restarting each edge and waiting for health.
Both edges finish healthy on the intended release.

Exact rollback checkpoints on gohan are under /opt/atlasrollback/: billing-20261022T190204Z,
klatch-20261022T190225Z, stohr-20261022T190251Z, bypath-20261022T190630Z,
pluck-20261022T190652Z, and standinghere-20261022T190709Z. Images are retained
under atlasrollback/<app>:<stamp>, with old source, manifests, lockfiles, and
validated PostgreSQL dumps. Pluck also retains its persistent data archive.
Corsair's checkpoint on mx is corsair-20261022T190801Z. Off-host copies are private
under ~/Desktop/backups/atlas/20261022/production. Lacey's independent release was
kept in place. These app migrations have no new application schema changes.


Measured follow-up: three alternating ten-second upload trials use four concurrent
16 MiB uploads to a slow reader, validating every hash. Median peak RSS is
327,336,944 bytes before and 58,704,592 after (82.1% less). Median completion rate
is 9.91 versus 9.50 uploads/s (4.2% less in this artificial per-chunk delay test);
spooling before signing trades disk work for bounded memory. The separate HTTP
throughput trials remain essentially unchanged. These are controlled fixtures,
not production capacity claims.

Fresh offline production bundles: Bypath 1,102,456 to 1,136,002 bytes (+3.0%);
Pluck 1,243,424 to 1,277,597 (+2.7%); StandingHere remains 1,754,273. Bypath and
Pluck browser sources import no Atlas library; their Mantine 9.6.1 to 9.7.3 and
React 19.3.0 to 19.3.1 updates accompany this separate frontend cost; the Bun compiler also changed. Their JavaScript
increases only 3,682 and 4,309 bytes; most growth is CSS. The shared Atlas server
packaging does not add browser modules. Compiler RSS samples are not idle-server
memory measurements.

Bypath agent 0.2.2 is available through its instance download endpoint for both
Mac and both Linux architectures; all four public archive bytes match their
local SHA-256 values, and latest resolves to 0.2.2. Pluck 0.2.1 is Developer ID
signed, notarized and stapled, published on its release repository, and independently
downloaded for integrity verification. Its Homebrew cask passes exact-package
style and online audit. Tap-wide CI still fails on unchanged Hopper/Sinclair style
and Tonic/Butter/Opm formula definitions; that does not make the Pluck package
audit green for the whole tap.


Final resource capture (2026-10-22): public, unauthenticated initial pages, three
sequential GETs per page; linked CSS/JS counts include same-origin assets only.
Times include the network from the development machine, not server-only latency.
Memory is a quiet production sample, not a controlled before/after load comparison.

| App/site | HTML KiB | Linked CSS/JS KiB | Median GET ms | Observed memory |
| --- | ---: | ---: | ---: | --- |
| billing | 0.4 | 32.7 | 63.5 | 12.54MiB |
| lacey | 0.9 | 370.2 | 57.5 | 15.96MiB |
| klatch | 0.6 | 119.0 | 83.6 | 16.75MiB |
| bypath | 0.5 | 1109.0 | 84.1 | 31.15MiB |
| pluck | 0.5 | 1247.2 | 70.6 | 65.14MiB |
| standinghere | 6.3 | 611.9 | 70.5 | 45.74MiB |
| stohr | 0.8 | 573.9 | 98.1 | 52.96MiB |
| corsair | 0.6 | 319.3 | 91.8 | 23.6 MiB (Bun) |
| school | 16.5 | 18.8 | 74.1 | 23.18MiB |
| undercover | 28.5 | 42.8 | 94.4 | 29.43MiB |
| schorror | 19.3 | 22.2 | 82.5 | 20.99MiB |
| apothecary | 10.6 | 64.5 | 57.9 | 30.23MiB |
| 803media | 25.0 | 31.5 | 96.3 | 24.96MiB |
| warren | 9.5 | 65.9 | 87.0 | 38.95MiB |

Bypath's second edge uses 29.34 MiB; StandingHere's seed/refresh/research workers
use 7.84/16.12/29.79 MiB. Corsair's TLS front uses 0.37 MiB. Apothecary was the
only CMS container without a memory ceiling: its compose definition and live
cgroup now match the other CMS sites at 320 MiB RAM / 640 MiB total RAM+swap.
The update caused no restart, public HTML change, or health failure.

Cubeplane's isolated production dashboard build is 648,191 JavaScript bytes and
438,427 CSS bytes (plus a 284-byte mark). It has no separate Bun server to sample.
OpenVendor's isolated Linux production image uses 22.13 MiB, serves a 486-byte
initial HTML page with 924,160 linked CSS/JS bytes, and has a 0.715 ms median local
GET in the three-request sample. No
public deployment exists. Its startup, assets, and test database are separate from
production. The earlier clean-image startup table supplies the same 1.6–3.0 second
observations for all nine server applications. Unavailable original baselines for
local file/link installations remain explicitly unavailable.

Pluck's Homebrew update is merged in homebrew-packages PR 1 and serves version
0.2.1 with the verified release checksum. Exact-package audits pass; the unrelated
tap-wide CI failures above remain recorded. Temporary tap registration was removed
without granting trust to other formulas. Native fixture browser login and Pluck
admin rendering pass, and Bypath's browser history records the native test tunnel.

Final cleanup removes the private application/PostgreSQL fixtures, their internal
network, disposable image tags, and SSH forwards. Production and rollback images
remain. Cache records were matched to 12 owned build-history entries; pruning
55 explicitly selected unused, unshared records reclaimed 1.787 GB. Root free space
then reads 3.6 GiB. No global image, volume, or cache prune was used. Verified host
sources/reports (7,378 archive entries) and verification report/document copies are retained
privately under ~/Desktop/backups/atlas/20261022/verification, with copy hashes.
All final production health checks pass; the unrelated Homebrew tap-wide CI
failures and the native maintenance warnings remain recorded above.

## Public module layout

Existing entry points remain canonical; narrower public entry points isolate
dependencies and are included in the coordinated release.

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

Fresh production dependency sizes below use Bun 1.4.4 with `--production
--omit=peer --frozen-lockfile --ignore-scripts`. The comparison includes stable
dependency upgrades as well as Atlas packaging. Runtime library source is unchanged
between the measured 0.4.4 web artifacts and 0.4.7, apart from CLI metadata and the
migration planner; native changes are separate. Development install sizes are not
used to claim savings. Original Cubeplane and OpenVendor file/link dependencies
have no standalone baseline.

| App | Original MiB | Migrated MiB | Change |
| --- | ---: | ---: | ---: |
| cubeplane | local file/link | 88.82 | no standalone baseline |
| openvendor | local file/link | 81.45 | no standalone baseline |
| billing | 18.28 | 8.70 | -52.4% |
| lacey | 62.69 | 62.66 | -0.1% |
| klatch | 18.28 | 1.17 | -93.6% |
| bypath | 121.46 | 114.80 | -5.5% |
| pluck | 295.54 | 289.16 | -2.2% |
| standinghere | 160.91 | 174.35 | +8.3% |
| stohr | 103.69 | 89.02 | -14.1% |
| inkling | 81.55 | 88.46 | +8.5% |
| corsair | 30.75 | 17.00 | -44.7% |

StandingHere grows mainly through the barcode library, and Inkling through newer
icons and the provider SDK. These are disk measurements, not browser bundle sizes
or process memory. Atlas libraries occupy approximately 0.3–1.9 MiB per app.


- [x] Record each app's resolved Atlas commit, lockfile, runtime/toolchain versions,
  selected modules, checks, and current deployment artifact.
- [x] Verify deployment status and the established deployment and rollback process
  for every app before selecting production canaries.
- [x] Capture installed dependency size, browser bundle size where applicable,
  startup time, idle memory, and representative request latency and throughput.
- [x] Measure memory under sustained traffic, concurrent streams, and slow clients.
- [x] Review the existing dependency/security audit changes as a release checkpoint;
  distinguish their behavior changes from packaging changes during validation.
- [x] Keep existing pinned applications on their current release until their
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
- [x] Remove unused Atlas aliases and dependencies based on source usage and the
  verified transitive graph, not merely what appears in old configuration.

## 4. Compatibility, security, and performance gates

Checked identity, payment, worker, and protocol gates below refer to the isolated
application/Atlas suites and disposable provider probes. They do not claim real
customer payments, provider posting, or every native GUI login was performed.
Public production checks were read-only and retained existing configuration.

- [x] Install each application against actual packed release artifacts; do not rely
  on workspace resolution or local links masking missing exports or dependencies.
- [x] Verify each migrated app with a clean, lockfile-based install of its released
  Atlas libraries in CI or a container without the Atlas source checkout mounted.
  Confirm its build, tests, and startup do not depend on local Atlas paths or links.
- [x] Update runtime image install commands to use `--production --omit=peer` after
  recording the complete selected dependency closure. Build frontend assets with
  development tooling before creating the clean production dependency tree.
- [x] Add a CI check that rejects local Atlas dependency paths and source-checkout
  aliases so applications cannot silently revert to filesystem dependencies.
- [x] Run each application's typechecks, builds, and relevant isolated tests.
  Inspect test setup first: several suites wipe and recreate test databases.
- [x] Verify sessions, password login, social callbacks, authorization, and logout.
- [x] Verify admin authorization explicitly grants administrator access and ordinary
  authenticated users cannot access privileged routes.
- [x] Exercise JWT expiry/not-before validation, OAuth state/PKCE, verified provider
  identity claims, SSO state binding, and logout replay protections where used.
- [x] Preserve existing secrets, encrypted provider keys, cookie behavior, API
  contracts, persistent volumes, and data across packaging migrations.
- [x] Verify checkout, Stripe Connect, subscription cancellation, invoices,
  webhook signatures/idempotency, and workers in isolated payment environments.
- [x] Configure explicit upload limits where the hardened default would reject
  valid uploads; keep bounds deliberate rather than disabling limits globally.
- [x] Verify large uploads/downloads, multipart transfers, range requests, and
  public/private signed storage access.
- [x] Verify SSE, WebSockets, cancellation, bounded queues, and slow-client behavior.
- [x] Check proxy trust, security headers, static-file access, and secret redaction
  in the actual application configuration.
- [x] Verify native-client login and API behavior alongside browser flows.
- [x] Compare startup, memory, bundles, latency, and throughput against baselines;
  report measured savings separately and investigate regressions before rollout.
- [x] Run Atlas's own suite, example, documentation build, generated templates, and
  clean minimal/server/UI consumer checks as release gates.
- [x] Retain an exact previous application artifact and lockfile for rollback;
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

- [x] Complete Cubeplane pilot (isolated; no production target).
- [x] Complete OpenVendor pilot (isolated; no production target).
- [x] Migrate Billing.
- [x] Migrate Lacey Recipes; current live metadata independently confirms 0.4.9.
- [x] Migrate Klatch.
- [x] Migrate Bypath.
- [x] Migrate Pluck.
- [x] Migrate StandingHere.
- [x] Migrate Stohr.
- [x] Migrate Inkling and inventory/validate each downstream instance.
- [x] Migrate Corsair.

## 6. Dependency cleanup and completion

- [x] Audit each app's remaining direct and transitive dependencies against current
  stable releases and security advisories at migration time.
- [x] Apply required API changes for stable dependency upgrades; resolve peer-version
  conflicts and duplicate frontend runtimes rather than forcing incompatible versions.
- [x] Validate dependency upgrades as a distinct step from the Atlas packaging switch
  so failures have an identifiable cause.
- [x] Remove obsolete vendored archives, install patches, aliases, and unused
  dependencies after replacements pass their checks.
- [x] Record each app's selected modules, exact release, validation results,
  deployment outcome, rollback artifact, and measured resource/performance changes.
- [x] Confirm all inventoried consumers and downstream Inkling sites are accounted
  for before removing exports or distribution paths they still rely on.
