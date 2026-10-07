# Climate Taxonomy v5 Explorer

An interactive dashboard for exploring the **CGIAR Climate Adaptation and Mitigation Taxonomy v5.0.0-draft (23 Sep 2026)**: 739 concepts in 11 facets, their hierarchy, typed relations, adaptation and mitigation rules, definition sources, provenance classes, the changes from version 4, and the governance records.

It is a static web app (no server, no network calls at runtime). It also builds as one self-contained HTML file that works offline by double-click.

## Credit and licence

**CGIAR Climate Adaptation and Mitigation Taxonomy v5.0.0-draft** by Andreea Nowak and Lolita Muller (Alliance of Bioversity International and CIAT) for the CGIAR MELIAF Climate Adaptation Activator.
Licence: CC BY 4.0 *intended, pending custodian confirmation (not a granted licence)*.
Source: [github.com/Mlolita26/cgiar-climate-taxonomy](https://github.com/Mlolita26/cgiar-climate-taxonomy) @ `2f867a0`. Official site: [mlolita26.github.io/cgiar-climate-taxonomy](https://mlolita26.github.io/cgiar-climate-taxonomy/).
Explorer: Synapsis Analytics.

Definitions quoted from published sources (IPCC glossaries, AGROVOC, FAO, WMO, UNFCCC and others) remain subject to their own terms; every definition names its source.

## Views

| View | What it shows |
| --- | --- |
| Overview | Version, KPI tiles, every concept as one square coloured by facet, facet composition, climate scope split, insights computed from the data |
| Hierarchy | Zoomable sunburst (all concepts, facet, top-level concept, narrower concepts to level 6) linked to a collapsible outline with filter and breadcrumb |
| Relations network | Force-directed graph of the 300 typed relations (canvas), filter chips per relation type and facet, relation definitions, neighbour highlight |
| Adaptation & mitigation | Specific / conditional / n/a tags per facet, anchors and hazards, decision rule cards ("counts as … when" / "does not count when") |
| Pathway flow | Sankey diagrams: domain, facet, scope; stage, facet, impact area; facet, scope, adaptation tag |
| Domains & impact areas | Heatmap of domain (or impact area, or pathway stage) by facet; select a cell to list concepts |
| Sources & provenance | Definition source families, IPCC by report, most cited sources, provenance classes and their combinations |
| Changes v4 to v5 | Change types, synonym changes, the 23 retired IDs with successors, searchable change tables |
| Governance & FAIR | DO-NOT-ADD register by exclusion type with a searchable table, decision log, FAIR self-assessment |
| Explore table | Faceted filters with live counts, full-text search over concept, synonyms, definition and ID, sorting, CSV export; filters are kept in the URL |
| Find concepts in a text | Simple label and synonym matching, no AI: paste a paragraph, see exact whole-word matches by facet |
| About & credit | Credit, licence, source commit, data preparation time |

A concept panel opens from anywhere and can be linked directly: `#/concept/CRK_102`. Global search: `⌘K` / `Ctrl K` or `/`.

## Build

Requires Node 20.19 or later (Vite 8).

```bash
npm ci
npm run build          # static web build in dist/ (relative paths, hash routing; deployable under any sub-path)
npm run build:single   # one self-contained HTML file: dist-single/index.html
```

Local preview of `dist/`:

```bash
scripts/serve.sh start      # http://127.0.0.1:8408/ (PORT=… to change); stop | status | restart
```

## Data

The app reads one generated file, `src/data/taxonomy.json`, which is committed so the build does not need the source repository. To regenerate it from a local clone of the custodians' repository (Python 3, standard library only):

```bash
git clone https://github.com/Mlolita26/cgiar-climate-taxonomy <clone>
git -C <clone> checkout 2f867a0
npm run prepare-data -- --src <clone>      # or TAXONOMY_SRC=<clone> npm run prepare-data
```

The script checks the source commit, verifies the sanity counts (739 concepts, 306 top-level, levels, facets, scopes, 982 synonyms on 592 concepts, 162 concepts with 300 typed relations, 157 CGIAR examples, the change-log and register sizes) and fails loudly if any differ. It records the source commit and the preparation time in the output.

### What the data file contains, and what it leaves out

- Concepts with children, ancestor path, depth, outgoing and incoming typed relations, definition source family, and provenance **classes** only (mapped with the custodians' provenance map). Raw provenance strings, source IDs and original labels are not included.
- The v4 to v5 change log, synonym changes, retired IDs, the DO-NOT-ADD register (without the `decided_by` column), the FAIR checklist and the decision log (decider shown as a role).
- Free-text notes in the change log and register use roles (domain expert, custodian) instead of personal names; references to communication channels and events are removed. A privacy audit in the script fails the build of the data file if a forbidden string remains.

## Verification

```bash
npm run build && npm run build:single && scripts/serve.sh start
SINGLE_FILE=dist-single/index.html node scripts/screenshot.mjs
```

The Playwright script visits every view, opens concept panels, runs a search, spot-checks four concepts in the panel against the JSON (label, definition, parent, relations, synonyms, official link), saves 1440×900 screenshots to `screenshots/`, opens the single-file build from `file://`, blocks any external request, and exits non-zero on any console error, page error or external request. Install a browser once with `npx playwright install chromium`.

## Known limits

- Draft content: numbers reflect the v5.0.0-draft at commit `2f867a0`.
- Definition source families are grouped from the first source listed for each definition; 187 definitions cite more than one source.
- The text matcher is plain label and synonym matching (case-insensitive, whole words, longest match first). It does not apply the decision rules and does not understand context.
- The sunburst sizes each concept equally (one unit per concept, so branches with more narrower concepts are wider).
