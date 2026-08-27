---
version: 1
slug: "site-index-html"
primary_target: "site/index.html"
related_targets: ["site/generator/index.ts","site/styles.css","site/app.js"]
---

# Atlas documentation site

## Scope and mode

- Surface: public landing page plus generated documentation and package-reference pages.
- Visitor mode: Read.
- Primary targets: `site/index.html`, `site/generator/index.ts`, `site/styles.css`, and
  `site/app.js`.

## Audience, job, and action

New adopters need a correct installation path and a fast model of how Atlas composes. Existing
users need direct package, guide, API, and source wayfinding. The first action is Start here; the
secondary action is Browse packages.

## Chosen direction

An Aegean field terminal from 1986: archaeological survey discipline, a celestial package map,
and late-CRT technical typography. Mythology is structural, not ornamental. Approved comp:
`.impeccable/mocks/constellation.png`.

The memorable moment is the 19-package constellation. It demonstrates composability while acting
as navigation. A smaller line-drawn Atlas and celestial sphere may support the dossier, following
`.impeccable/mocks/atlasfigure.png`, but cannot compete with the map.

## Composition commitments

- A compact utility strip and primary navigation establish the terminal frame.
- The first viewport uses an asymmetrical dossier/map split near 28/72 at desktop widths.
- The dossier contains the product statement, install command, and two actions.
- The constellation uses every real root package name and remains semantic navigation.
- Quick start and guide routes begin at the lower edge of the first viewport.
- Documentation pages replace the map with a scan-friendly sidebar, article, and local contents.
- Mobile collapses to a linear reading order; package nodes become a two-column manifest.

## Built system inventory

| Ingredient | Medium | Commitment |
| --- | --- | --- |
| Utility strip and navigation | Semantic HTML/CSS | Thin cyan rules, square controls, current-page state |
| Dossier | Semantic HTML/CSS | Limestone headline, mono labels, no rounded card shell |
| Package constellation | Authored SVG plus HTML links | Nineteen nodes, dependency group lines, keyboard access |
| Atlas figure | Authored SVG | Line drawing only; subordinate scale and contrast |
| Greek-key registration rule | CSS pattern | One measured band, not repeated decoration |
| Install and code slabs | Semantic code and buttons | Copyable text, visible focus, no rasterized UI text |
| Guide and package references | Generated semantic HTML | Canonical Markdown rendered at build time |
| Site motion | CSS and a bounded pointer response | One celestial drift; reduced-motion still state |
| Generated comps | Review-only raster | Never shipped as content or evidence |

## Sampled palette and material

- Deep page ground: `#000818` sampled from the approved comp.
- Raised field: `#071426`, derived from the comp's panel range.
- Limestone type: `#c3b5a7` sampled from the approved comp.
- Ionian cyan: `#53c7ee`, raised from the comp's antialiased cyan sample for AA contrast.
- Registration magenta: `#f0448f`, raised from the comp's antialiased magenta sample.
- Supporting blue-gray: `#6f8799`.

Borders are one-pixel cyan at low opacity. Corners are square or cut, never softly rounded.
Elevation comes from field contrast and restrained phosphor bloom, not drop-shadow cards.

## Type and spacing

- Display: self-hosted Big Shoulders, uppercase and tracked; the ATLAS wordmark uses the heaviest
  available cut.
- Reading: `Optima`, `Segoe UI`, and system sans fallbacks.
- Technical: `SFMono-Regular`, `Cascadia Code`, and monospace fallbacks.
- Type ramp: 12px labels, 16–18px body, 28–40px article headings, 80–132px home wordmark.
- Dense controls sit on an 8px rhythm; long-form article text uses a calmer 24–32px rhythm.

## Constraints and unresolved decisions

GitHub Pages uses the repository path `/atlas/`. The build cannot depend on client-side Markdown
rendering. There is no custom domain or external font dependency. No testimonials, benchmarks,
customer logos, or adoption claims may be invented.
