---
name: Atlas
description: A midnight Aegean field terminal for composable Bun, TypeScript, and Rust reference.
colors:
  aegean-ground: "#000818"
  observatory-field: "#071426"
  limestone: "#c3b5a7"
  bright-limestone: "#eee5d8"
  ionian-cyan: "#53c7ee"
  survey-cyan: "#32677f"
  registration-magenta: "#f0448f"
  muted-blue-gray: "#91a9bb"
  faint-blue-gray: "#748da0"
  survey-line: "rgb(83 199 238 / 28%)"
  survey-line-strong: "rgb(83 199 238 / 58%)"
  modal-backdrop: "rgb(0 4 15 / 82%)"
typography:
  display:
    fontFamily: '"Big Shoulders", "Arial Narrow", sans-serif'
    fontSize: "clamp(5rem, 9vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.82
    letterSpacing: "0.08em"
  headline:
    fontFamily: '"Big Shoulders", "Arial Narrow", sans-serif'
    fontSize: "clamp(28px, 2.8vw, 40px)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.05em"
  title:
    fontFamily: '"Big Shoulders", "Arial Narrow", sans-serif'
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.04em"
  body:
    fontFamily: 'Optima, Candara, "Segoe UI", system-ui, sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  label:
    fontFamily: '"SFMono-Regular", "Cascadia Code", "Roboto Mono", monospace'
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "0.1em"
  micro:
    fontFamily: '"SFMono-Regular", "Cascadia Code", "Roboto Mono", monospace'
    fontSize: "9px"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "0.1em"
  control:
    fontFamily: '"SFMono-Regular", "Cascadia Code", "Roboto Mono", monospace'
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "0.08em"
  navigation:
    fontFamily: '"SFMono-Regular", "Cascadia Code", "Roboto Mono", monospace'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "0.1em"
  node:
    fontFamily: '"SFMono-Regular", "Cascadia Code", "Roboto Mono", monospace'
    fontSize: "clamp(10px, 0.85vw, 13px)"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "0.07em"
  caption:
    fontFamily: 'Optima, Candara, "Segoe UI", system-ui, sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  compact:
    fontFamily: 'Optima, Candara, "Segoe UI", system-ui, sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  result:
    fontFamily: 'Optima, Candara, "Segoe UI", system-ui, sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  lead:
    fontFamily: 'Optima, Candara, "Segoe UI", system-ui, sans-serif'
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  intro:
    fontFamily: 'Optima, Candara, "Segoe UI", system-ui, sans-serif'
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  statement:
    fontFamily: 'Optima, Candara, "Segoe UI", system-ui, sans-serif'
    fontSize: "clamp(21px, 2.2vw, 30px)"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "0.015em"
  minor-heading:
    fontFamily: '"Big Shoulders", "Arial Narrow", sans-serif'
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.03em"
  subheading:
    fontFamily: '"Big Shoulders", "Arial Narrow", sans-serif'
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.03em"
  brand:
    fontFamily: '"Big Shoulders", "Arial Narrow", sans-serif'
    fontSize: "32px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.16em"
  article-section:
    fontFamily: '"Big Shoulders", "Arial Narrow", sans-serif'
    fontSize: "clamp(30px, 4vw, 42px)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.03em"
  article-display:
    fontFamily: '"Big Shoulders", "Arial Narrow", sans-serif'
    fontSize: "clamp(3.5rem, 7vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.82
    letterSpacing: "0.08em"
  article-display-mobile:
    fontFamily: '"Big Shoulders", "Arial Narrow", sans-serif'
    fontSize: "clamp(3.4rem, 17vw, 5rem)"
    fontWeight: 900
    lineHeight: 0.82
    letterSpacing: "0.08em"
  guide-display:
    fontFamily: '"Big Shoulders", "Arial Narrow", sans-serif'
    fontSize: "clamp(4.8rem, 10vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.82
    letterSpacing: "0.08em"
  guide-display-mobile:
    fontFamily: '"Big Shoulders", "Arial Narrow", sans-serif'
    fontSize: "clamp(4.4rem, 22vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.82
    letterSpacing: "0.08em"
rounded:
  square: "0"
spacing:
  control: "8px"
  compact: "12px"
  module: "18px"
  content: "24px"
  section: "30px"
components:
  button-primary:
    backgroundColor: "{colors.limestone}"
    textColor: "{colors.aegean-ground}"
    rounded: "{rounded.square}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.ionian-cyan}"
    textColor: "{colors.aegean-ground}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ionian-cyan}"
    rounded: "{rounded.square}"
    padding: "10px 18px"
  button-secondary-hover:
    backgroundColor: "rgb(83 199 238 / 8%)"
    textColor: "{colors.bright-limestone}"
  icon-control:
    backgroundColor: "transparent"
    textColor: "{colors.ionian-cyan}"
    rounded: "{rounded.square}"
    padding: "8px"
    size: "36px"
  filter-field:
    backgroundColor: "transparent"
    textColor: "{colors.bright-limestone}"
    rounded: "{rounded.square}"
    padding: "7px 8px"
  navigation-link:
    backgroundColor: "transparent"
    textColor: "{colors.muted-blue-gray}"
  code-slab:
    backgroundColor: "{colors.aegean-ground}"
    textColor: "{colors.bright-limestone}"
    rounded: "{rounded.square}"
    padding: "22px"
  field-route:
    backgroundColor: "transparent"
    textColor: "{colors.ionian-cyan}"
    typography: "{typography.title}"
    rounded: "{rounded.square}"
    padding: "26px"
  constellation-node:
    backgroundColor: "transparent"
    textColor: "{colors.ionian-cyan}"
    rounded: "{rounded.square}"
---

# Design System: Atlas

## Overview

**Creative North Star: "Aegean Field Terminal 1986"**

Atlas inhabits a midnight Aegean observatory terminal: deep navy fields hold limestone type,
cyan survey lines, and sparse magenta registration marks. The interface is dense but not cramped,
with the discipline of a field dossier and the legibility of a technical reference. Condensed
display type supplies the monumental scale; readable humanist text and monospaced labels keep the
system useful beside an editor.

Greek mythology appears through naming, measured geometry, the Atlas line figure, temple-like
divisions, and the package constellation. The 1980s layer comes from restrained CRT bloom,
terminal labels, and chromatic instrument marks. The system rejects faux-vaporwave kitsch,
generic purple gradients, ornamental controls, and raster-heavy delivery.

**Key Characteristics:**

- Midnight navy fields separated by thin cyan survey rules.
- Limestone display and reading type with cyan technical labels.
- Square terminal controls and disciplined one-pixel construction.
- Magenta used only for registration, focus, and exceptional state.
- The package constellation as the reusable signature pattern.

## Colors

The palette is a dark maritime field with warm stone text and two precise instrument accents.

### Primary

- **Ionian Cyan** (`colors.ionian-cyan`): Primary links, package nodes, active states, icons, and
  high-value technical labels.
- **Survey Cyan** (`colors.survey-cyan`): Quiet rules, underlines, scrollbar thumbs, and secondary
  diagram marks.

### Secondary

- **Registration Magenta** (`colors.registration-magenta`): Focus outlines, selected diagram
  geometry, taxonomy labels, markers, and failure states.

### Neutral

- **Aegean Ground** (`colors.aegean-ground`): Page ground, code slabs, and high-contrast control
  text on light actions.
- **Observatory Field** (`colors.observatory-field`): Dossiers, navigation trays, callouts, and
  long-form support surfaces.
- **Limestone** (`colors.limestone`): Default reading text and the primary-action surface.
- **Bright Limestone** (`colors.bright-limestone`): Display type and emphasized labels.
- **Muted Blue-Gray** (`colors.muted-blue-gray`): Supporting prose and inactive navigation.
- **Faint Blue-Gray** (`colors.faint-blue-gray`): Metadata, captions, and low-priority labels.
- **Survey Line** (`colors.survey-line`): Default dividers, borders, and grid construction.
- **Strong Survey Line** (`colors.survey-line-strong`): Section boundaries and interactive strokes.
- **Modal Backdrop** (`colors.modal-backdrop`): Focus-preserving dimmer behind the search plane.

### Named Rules

**The Instrument Marks Rule.** Ionian cyan carries structure and action; registration magenta marks
focus, selection, and exception. Neither becomes a broad decorative fill.

**The Night Field Rule.** Keep the Aegean ground dominant and build hierarchy with the two field
tones before introducing glow or shadow.

## Typography

**Display Font:** Big Shoulders (with Arial Narrow and sans-serif fallback)

**Body Font:** Optima (with Candara, Segoe UI, system-ui, and sans-serif fallback)

**Label/Mono Font:** SFMono-Regular (with Cascadia Code, Roboto Mono, and monospace fallback)

**Character:** Big Shoulders gives Atlas its condensed, monolithic terminal face without turning
reading text into display copy. Humanist body text softens long documentation, while the mono
voice marks controls, coordinates, code, metadata, and system state.

### Hierarchy

- **Display** (900, responsive `5rem`–`6rem`, 0.82): Monumental page identities and the ATLAS
  wordmark, uppercase with measured tracking, sized with `clamp(5rem, 9vw, 6rem)`.
- **Headline** (700, responsive `28px`–`40px`, 1): Major field and section headings, generally
  uppercase, sized with `clamp(28px, 2.8vw, 40px)`.
- **Title** (700, `24px`, 1): Route titles, index rows, and compact panel headings.
- **Body** (400, `16px`, 1.65): Documentation and supporting explanation, constrained to a
  `72ch` reading measure where long-form text appears.
- **Label** (400, `10px`, `0.1em`, uppercase): Terminal metadata, coordinates, taxonomy, control
  text, and diagram legends.
- **Supporting Scale** (`9px`–`19px`): Named micro, control, navigation, caption, compact,
  result, lead, and intro roles keep dense metadata distinct from readable supporting prose.
- **Responsive Display Scale:** Statement, article, guide, and section roles own their fluid
  clamps; mobile variants tighten only the two long-form page identities.

### Named Rules

**The Three Voices Rule.** Display type names the terrain, body type explains it, and mono type
operates it. Do not use condensed display type for paragraphs or body type for terminal state.

## Layout

The outer field is capped at `1600px` and framed with inline survey rules. The home hero uses a
`minmax(330px, 28%) 1fr` dossier-to-constellation split; documentation uses a
`250px / minmax(0, 820px) / 210px` navigation, article, and contents grid. A subtle `64px` page
grid provides reference without becoming decoration, and article copy stays within `72ch`.

Dense controls use the repeated `8px`, `12px`, and `18px` steps. Content blocks use `24px`, while
`30px` begins the section rhythm; larger responsive gaps use fluid clamps rather than adding a
second spacing system. At `1180px` the local contents rail drops away. At `900px` the hero and
documentation shell become linear and primary navigation becomes a full-width tray. At `680px`,
route lists stack, package nodes become a two-column manifest, and article gutters reduce to
`20px`.

## Elevation & Depth

The system is flat by default. Depth comes from the contrast between Aegean Ground and Observatory
Field, reinforced by one-pixel survey boundaries. The display wordmark uses a
low cyan phosphor bloom (`0 12px 36px rgb(83 199 238 / 12%)`), constellation nodes use a tighter
instrument glow (`0 0 16px rgb(83 199 238 / 54%)`), and their hover state adds a restrained
drop-shadow (`0 6px 12px rgb(83 199 238 / 20%)`). Only the modal search surface receives a
structural shadow (`0 24px 70px rgb(0 0 0 / 62%)`).

### Shadow Vocabulary

- **Display Phosphor** (`text-shadow: 0 12px 36px rgb(83 199 238 / 12%)`): Low cyan bloom
  behind the home wordmark.
- **Node Instrument** (`box-shadow: 0 0 16px rgb(83 199 238 / 54%)`): Tight glow around
  constellation diamonds.
- **Node Hover** (`filter: drop-shadow(0 6px 12px rgb(83 199 238 / 20%))`): Transient lift on
  an active constellation node.
- **Modal Structural** (`box-shadow: 0 24px 70px rgb(0 0 0 / 62%)`): Structural separation
  for the modal search plane.

### Named Rules

**The Field-First Depth Rule.** Establish separation with field tone and one-pixel rules; reserve
shadow for the modal plane and glow for luminous instrument marks.

## Shapes

Controls, fields, cards, dialogs, and code slabs use square corners (`0`). Borders are one pixel,
with low-opacity cyan for internal divisions and the stronger line for section edges. Circles and
diamonds belong to instruments: orbital rings, crosshairs, and rotated package markers. The Greek
key appears as one measured registration band, while the Atlas figure remains a subordinate line
drawing rather than a filled illustration.

### Named Rules

**The Instrument Geometry Rule.** Keep functional surfaces square; use circles and diamonds only
when they communicate coordinates, nodes, or celestial measurement.

## Components

Components feel calibrated and technical: square, compact, strongly focused, and animated only
enough to confirm state.

### Buttons

- **Shape:** Square terminal control (`0`) with a `44px` minimum height and `10px 18px` padding.
- **Primary:** Limestone surface, Aegean Ground text, and limestone stroke; hover shifts both
  surface and stroke to Ionian Cyan.
- **Secondary:** Transparent field, Ionian Cyan text, and a strong survey stroke; hover adds an
  eight-percent cyan field and Bright Limestone text.
- **Hover / Focus:** Color transitions use `180ms` and the shared field easing. Keyboard focus is a
  `2px` Registration Magenta outline offset by `4px`.

### Inputs / Fields

- **Style:** Transparent, square underline field with Bright Limestone mono text and `7px 8px`
  padding.
- **Focus:** The underline changes from Strong Survey Line to Registration Magenta without adding
  a filled shell.
- **Search Scale:** Compact filters are `12px`; the modal search field grows to `16px` with
  `13px 0` padding.

### Navigation

- **Primary:** Uppercase mono links begin in Muted Blue-Gray and reveal a one-pixel Ionian Cyan
  underline over `220ms`; hover, focus, and current-page states shift to Bright Limestone.
- **Mobile:** Below `900px`, the links move into a full-width Observatory Field tray with `46px`
  rows and survey-line separators.
- **Icon Controls:** Square `36px` controls use an eight-pixel inset, cyan line icons, and the global
  magenta focus outline.

### Cards / Containers

- **Corner Style:** Square (`0`) with no isolated rounded shell.
- **Background:** Aegean Ground or Observatory Field depending on hierarchy; hover may add a
  six-to-eight-percent cyan field.
- **Shadow Strategy:** Flat at rest and divided by survey rules; only the modal uses structural
  shadow.
- **Internal Padding:** Route fields use `26px`; compact list rows use `12px 14px`; article callouts
  use `22px 24px`.

### Code Slabs

Code uses Aegean Ground, Bright Limestone mono text, a Survey Line border, and `22px` internal
padding. Copy controls sit inside the top-right corner as compact square field buttons and change
their stroke to Ionian Cyan on hover.

### Package Constellation

The signature component maps package links as cyan mono labels anchored by eight-pixel luminous
diamonds. Dashed orbital rings and dependency lines establish composition; hover or focus changes
the node to Registration Magenta. Pointer motion is bounded to twelve pixels and uses a `700ms`
drift. Below `680px`, the celestial plot becomes a semantic two-column manifest and sheds the
decorative lines, crosshair, legend, and drift.

### Survey Stations

The field survey is the site's front door: one numbered station per page, at `/<n>/`. The station is
the second signature component after the constellation, and it carries one rule the rest of the
system does not — **the accent identifies which half of Atlas you are standing in.** Web stations
resolve `--station` to Ionian Cyan; desktop stations resolve it to Registration Magenta, which is the
single sanctioned exception to magenta-as-registration-mark-only. The opening and the both-fields
station fall back to Limestone.

- **Instrument strip:** a mono label row above the station carrying the field, the kind and number,
  and the reader's accumulated route, divided from the station by one survey rule.
- **Station number:** the section number set in the display face at `clamp(5.5rem, 15vw, 9.5rem)`
  and sixteen-to-twenty-two-percent opacity, so the page is identifiable across a room without
  competing with the headline that overlaps it.
- **Registration marks:** fourteen-pixel magenta corner ticks at the station's top-left and
  bottom-right, decorative and hidden below `640px`.
- **Choice rows:** a square mono key, the label, a dotted leader in the station's dim accent, and the
  destination as `§n`. The leader takes the slack between label and destination the way a printed
  contents page sets it, and is dropped below `640px` where it reads as a smudge.
- **Plate blocks:** endings add the carried stack, a copyable command, one code slab, and reading
  chips — the chips keep package names in their own case, because they are names, not labels.

The keys beside each choice are the keyboard shortcuts. Any station renders and navigates with
JavaScript disabled; the route trail and the number keys are enhancement only.

## Do's and Don'ts

### Do:

- Do preserve the deep field hierarchy before reaching for shadow.
- Do use limestone for readable text and cyan for technical structure and action.
- Do keep controls square, compact, keyboard-visible, and divided by one-pixel survey rules.
- Do use the constellation, survey stations, Atlas figure, and Greek geometry as structural signatures.
- Do let the station accent say which half of Atlas a page belongs to, and nothing else.
- Do disable orbital motion and state transitions when reduced motion is requested.

### Don't:

- Don't turn the palette into a generic purple gradient or broad neon wash.
- Don't use magenta as a general surface color; it is a registration and exception mark, plus the
  desktop station accent.
- Don't add soft rounded cards, ornamental controls, or decorative dashboard shells.
- Don't set long-form documentation in the condensed display face or mono label face.
- Don't rasterize interface text, diagrams, or package navigation.
