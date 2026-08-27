# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Atlas serves three primary audiences equally:

- Bun and TypeScript developers evaluating whether Atlas fits a new project.
- Existing Atlas users looking up package boundaries, exports, and working patterns while coding.
- Coding and runtime agents loading only the package context required for a task.

## Product Purpose

Atlas is a collection of composable, functional Bun/TypeScript building blocks for APIs,
full-stack applications, and CLI tools. The documentation site must make the system legible,
get a new user to a correct first import quickly, and turn the repository's canonical Markdown
into both browsable and machine-readable references without creating a second source of API truth.

## Positioning

Atlas exposes Bun-native capabilities as small, shallowly connected packages. It uses functions,
immutable data, and pipe composition instead of framework-wide adoption, classes, or Node.js
compatibility layers.

## Operating Context

Readers arrive from the public GitHub repository, npm, search, a package import, `llms.txt`, or an
agent tool. They may be evaluating Atlas from a phone, reading a guide beside an editor, jumping
directly to a package reference, or retrieving one canonical document through the CLI or MCP.
Source lives in `README.md`, `docs/*.md`, `llms.txt`, and `packages/<name>/AGENTS.md`; GitHub Pages
is the public delivery surface.

## Capabilities and Constraints

- The package is installed as `@wess/atlas` and consumed through subpath exports.
- Atlas is Bun-only and uses TypeScript strict mode.
- The public site is static, dependency-light, responsive, and deployable by GitHub Actions.
- Documentation pages are generated from canonical repository Markdown during the build.
- Every documentation page publishes its exact canonical source through a Markdown alternate.
- `llms.txt`, `llms-full.txt`, and `search.json` expose concise, complete, and structured discovery.
- HTML pages advertise their Markdown alternate and the agent index through link relations.
- The CLI and MCP server retrieve the same canonical documents used by the public site.
- The site supports keyboard navigation, reduced motion, and readable long-form code examples.

## Brand Commitments

- Product name: Atlas.
- Voice: direct, technical, compact, and confident without inflated claims.
- Visual brief: Greek mythology interpreted through an '80s lens.
- The mythology belongs in the structure and symbols; it must not obscure technical reading.

## Evidence on Hand

- Package source and export map: `packages/` and `package.json`.
- Product overview and installation: `README.md`.
- Guides and cross-package reference: `docs/`.
- Canonical per-package references: `packages/*/AGENTS.md`.
- Working examples and ten scaffolds: `example/` and `templates/`.
- Automated behavior checks: `packages/*/test/`.

No testimonials, adoption metrics, benchmarks, or customer claims are available and none should
be invented for the site.

## Product Principles

- Put a correct first success before architectural depth.
- Preserve one canonical source for every API fact.
- Give agents the smallest sufficient context before offering the complete corpus.
- Make package boundaries visible at a glance.
- Let the visual system create memory without taxing comprehension.
- Keep every public example executable and Bun-native.
