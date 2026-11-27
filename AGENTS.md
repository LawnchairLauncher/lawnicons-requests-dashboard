## 1. Purpose

### Project Summary
A high-performance, vanilla-web dashboard for managing community icon requests for Lawnicons. It turns static JSON/XML datasets into an interactive triage tool: browse and filter requests, inspect popularity/domain/activity stats, plan contributions, review SVG quality, browse community home screens, and export bundles for contributors.

### Scope
Included:
- Infinite scrolling / lazy rendering (`CONFIG.ui.batchSize = 500`) for datasets exceeding 10k items.
- Deep-linking via URL parameters for shared filter, view, sort, and tool-page states.
- Client-side ZIP generation with `appfilter.xml`, `icontool_commands.txt`, `filter_config.json`, and source icons.
- Material Design 3 (M3) inspired UI with keyboard navigation and accessible menus/tooltips.
- Local Python scripts for data enrichment, pruning, tagging, and build-time QA.
- Local, lazily loaded `fflate` for ZIP compression.

Excluded (non-goals):
- Server-side state or user databases. The dashboard remains strictly static.
- Framework-specific implementations (React, Vue, etc.).
- Direct file system writes from the browser.
- Node.js build tooling for the dashboard itself.

## 2. System Architecture

### Tech Stack
- **Languages:** JavaScript (ESNext), CSS3, HTML5, Python 3.10+ (scripts).
- **Frameworks:** None (vanilla JS modules are plain script files, not ES modules).
- **Runtime:** Browser-based; deploy as static files (Vercel).
- **Type checking:** `// @ts-check` in `src/script.js`, JSDoc, global declarations in `src/types.d.ts`, config in `deno.json` (`allowJs`/`checkJs`).
- **Compression library:** Vendored `src/fflate.umd.js`, loaded on first export via `loadFflate()`. There is no CDN script tag in `src/index.html`.
- **Server-side validation:** none; run locally with any static server, e.g. `python3 -m http.server 8765 --directory src`.

### High-Level Structure
- **Bootstrap:** `src/index.html` loads `lint_icons.js` and `script.js`. `Data.init()` runs immediately; `UI.init()` performs the first render.
- **Data Layer:** `App.data` holds `requests.json` apps. Auxiliary datasets are split into critical and deferred phases (see below).
- **State Layer:** Runtime state is centralized in `App.state` with lookup maps, derived indices, analytics tables, and URL-backed UI mode.
- **Namespace Layer:** Top-level objects: `App`, `Utils`, `Templates`, `Components`, `Actions`, `Data`, `UI`. `Components` contains `Toast` and `Tooltip`. `Heuristics` is currently a placeholder.
- **Event Layer:** Document-level delegation, targeted control listeners, popover/context-menu handlers, `IntersectionObserver` for infinite scroll, and keyboard navigation handlers.
- **Data flow:** JSON/XML → `Data.init()` → `App.state` maps/indices → `Data.process()` → `UI.render()` / `UI.loadMore()` → `Templates` / DOM.

### Loading Phases
- **Critical (before first render):** `requests.json`, `assets/filters/*.json`, `assets/stats/sets_stats.json`, `domain_stats.json`, `activity_stats.json`, `assets/iconsyouneedmost.json`, `assets/contributor_points.json`, then `idMap`, `appTags`, `filterMetadata`.
- **URL resolution:** `Data.loadUrlState()` runs before any render. If the URL genuinely needs graphs (`regex` with text, `q=scr-N`, `view=screens` unless `tab=points-leaderboard`, `tab=homescreens`), `Data.loadGraphData()` is awaited before `UI.init()`.
- **First paint:** `UI.init()` renders the first batch immediately after critical data (and required graphs) are ready.
- **Deferred:** scheduled after the first frame via `requestIdleCallback` (fallback `setTimeout`): graph datasets, optional stats, review issues, and `appfilter.xml`. A single `UI.refreshAfterDeferredData()` updates cards/badges and re-renders while preserving `renderedCount` and scroll position.
- **On demand:** `excluded_packages.json` is fetched and memoized by `Data.getDynamicMatches()`. Failures in optional datasets are non-fatal.

### Data Files
- `assets/requests.json`: primary flat app dataset.
- `assets/filters/{supported,redesign,easy,foss,nameinuse,match,stale}.json`: filter membership + metadata. `plan` is synthesized in code and persisted in `localStorage`; `unlabeled` is computed at runtime. A `plan.json` 404 is expected.
- `assets/requests_graph.json`: component → neighboring components (geo regex/screen matching).
- `assets/screens_graph.json`: screen ID (`scr-N`) → component list.
- `assets/home_screens/entries.json` and `images/*.webp`: home-screen cards.
- `assets/appfilter.xml`: canonical existing icon list (`ComponentInfo{...}` items).
- `assets/excluded_packages.json`: `dynamic` and `dead` package lists for dynamic-match commands.
- `assets/stats/sets_stats.json`: popularity overrides for sorting.
- `assets/stats/domain_stats.json`: domain breakdown card, tooltip, `_population`.
- `assets/stats/activity_stats.json`: activity card.
- `assets/stats/fulfillment_history.json`: icons/day for the activity card.
- `assets/stats/trending_baseline.json`: `trending` sort deltas.
- `assets/iconsyouneedmost_emails.json`: source of email-based priority ranks. `scripts/sync_contributor_points.py` combines it with Lawnicons `contribution-points/*.txt` to generate `assets/iconsyouneedmost.json`.
- `assets/contributor_points.json`: derived `earned` / `spent` / `balance` summary per contributor, used by the leaderboard.
- `assets/qa_issues/review_issues.json`: low-quality badge and QA page.
- `assets/qa_issues/review_pass.json`, `assets/qa_issues/svgs/`: build-time QA data/SVGs (not part of the dashboard startup).
- `assets/dead_links.json`: build-time input for `scripts/dump_play_info.py`, not fetched by the dashboard.
- There is no `creation_odds.json` in the current pipeline.

### `requests.json` Structure
`firstAppearance` and `lastRequested` are Unix timestamps in seconds; `installs` is a string with commas and a plus sign. Optional fields include `roi_score` and `priority`.

```json
{
  "count": 1,
  "lastUpdate": "2026-01-01",
  "apps": [
    {
      "drawable": "drawable_in_snake_case",
      "requestCount": 100,
      "firstAppearance": 1767196800.0,
      "lastRequested": 1767196800.0,
      "label": "App Title",
      "componentName": "com.example/com.example.MainActivity",
      "installs": "100,000,000+"
    }
  ]
}
```

### Filter Dataset Shape
Each filter file is an object with `label`, `description`, and an array under the filter ID. Entries may be component-name strings or objects carrying `existing_drawable`:

```json
{
  "label": "Example",
  "description": "Example filter",
  "example": ["com.example/com.example.MainActivity", { "id": "com.a/com.a.Main", "existing_drawable": "existing_icon" }]
}
```

`App.state.existingSvgs` is populated from `existing_drawable` metadata. `App.state.appTags` is the canonical tag lookup and is used by `Data.process()`.

### `appfilter.xml` Structure
```xml
<resources>
  <item component="ComponentInfo{COMPONENT_NAME}" drawable="ICON_NAME" name="APP_NAME" />
  <item component="ComponentInfo{app.lawnchair.lawnicons/app.lawnchair.lawnicons.MainActivity}" drawable="lawnicons" name="Lawnicons" />
</resources>
```

### URL State
`Data.loadUrlState()` / `Data.syncUrlState()` are the only places that read/write these parameters:

| Parameter | Meaning |
| --- | --- |
| `q` | Search text, regex, or `scr-N` query |
| `view` | `list` (default), `grid`, or `screens` |
| `sort` | Any key from `UI.sortOptions`; screens view uses `UI.screenSortOptions`, and `tab=points-leaderboard` uses `UI.contributorSortOptions` |
| `regex` | `1` enables regex mode |
| `filters` | Comma-separated active filter IDs |
| `page` | `low-quality-icons`, `contribution-plan`, `icon-review` |
| `tab` | `requests` (default), `points-leaderboard`, or `homescreens` |

There is no `geo` URL parameter. Geo information is derived from `requests_graph` into `App.state._geoPrefixById` and shown as row prefixes; there is no separate geo-batch mode.

### UI Modes
- **Main tabs:** `requests`, `points-leaderboard`, and `homescreens`. `view=screens` also selects the screens presentation. The points tab renders a sortable leaderboard from `assets/contributor_points.json`, defaulting to `balance-desc`; `Icons` is derived as `earned / 5`. The leading position is the rank by balance and stays fixed when another column is sorted.
- **Views:** `list`, `grid`, `screens` (separate `screenSort` state).
- **Tool pages:** low-quality QA, contribution plan, icon review. These replace the main content; `page` records the active one.
- **Contribution plan:** stored in `localStorage` keys `lawnicons_contribution`, `lawnicons_contribution_overrides`, `lawnicons_contribution_active`; entries receive the `plan` tag.
- **Bundle action mode:** `App.state.actionMode` is `new` (include `_icons/` in ZIP) or `link` (metadata only).
- **Icon review:** uses the browser port `src/lint_icons.js` (rules C01, C05, C06, C07, O01) and allows importing an `appfilter.xml`.

### Dependency Rules
Allowed:
- Small, single-purpose local utilities (currently vendored `fflate`).
- Local static assets and Python scripts for data generation.

Forbidden:
- UI frameworks (React/Vue/Angular).
- CSS-in-JS libraries.
- Node.js build-time requirements for the dashboard.
- Loading critical app logic from a CDN.

## 3. Invariants (Must Never Break)

Functional:
- URL parameters are the source of truth on page load for `q`, `view`, `sort`, `regex`, `filters`, `page`, and `tab`.
- `App.state.selected` (keyed by `componentName`) must persist through search, filter, sort, view, tool-page changes, and the deferred-data refresh.
- Regex mode, `scr-N` queries, and screens/home-screen deep links must wait for their graph data before the first render; other URLs must not wait.
- Invalid regex input must degrade safely to zero results, not crash the app.
- Optional-data fetch failures must be non-fatal and leave usable defaults in `App.state`.

Export correctness:
- `Actions.downloadBundle()` produces `appfilter.xml`, `filter_config.json` (selection flow only), `icontool_commands.txt`, and optionally `_icons/` for `new` mode.
- `Actions.downloadContributionBundle()` produces `appfilter.xml`, `icontool_commands.txt`, and optionally `_icons/`; it does **not** contain `filter_config.json`.
- There is no `pr_description.md` file in either ZIP.
- Every filename in `_icons/` must match the `drawable` written to `appfilter.xml` and `icontool_commands.txt`.
- In `downloadBundle()`, drawables are assigned deterministically per `componentName`; a different component with a colliding name receives stable `_2`, `_3`, … suffixes. Contribution mode respects user-edited label/drawable overrides.

Architectural:
- String HTML fragments live in `Templates`; direct DOM creation is acceptable for small controls, observers, tooltips, and focus plumbing.
- Incremental rendering builds one HTML string per batch, parses it once, and appends through a `DocumentFragment` (`UI.loadMore()`).
- `App.state.idMap` keeps O(1) lookup for all loaded apps.
- `App.state.appTags`, `filterMetadata`, `existingSvgs`, `_geoPrefixById`, and analytics maps are the canonical lookup sources after initialization.
- Deferred datasets trigger exactly one coordinated refresh (`UI.refreshAfterDeferredData()`), never separate per-dataset re-renders.

Performance:
- Target: first meaningful paint from critical data only; heavy graphs/XML must not block the common path.
- Critical hot paths: `Data.process()` (filter/sort loop), `UI.loadMore()` (batch rendering), `Data.getDynamicMatches()` (memoized commands).
- `loadFflate()` is awaited only inside export functions.

## 4. Modification Protocol

1. **Identify:** Build-time (Python/data generation) or runtime (JS/UI/export) work.
2. **State:** Update `App.state` and its default initialization when the runtime data shape changes; add matching JSDoc in `src/script.js` and declarations in `src/types.d.ts`.
3. **Loading phase:** Decide whether a new dataset is critical, graph-required by a deep link, deferred, or on demand. Add it to the corresponding `Data.init()` phase and to `UI.refreshAfterDeferredData()` if it affects rendered UI.
4. **URL Sync:** If behavior is deep-linkable, update both `Data.loadUrlState()` and `Data.syncUrlState()`, plus `needsGraphData` if graphs are required.
5. **Processing Path:** If search, tags, sort, or special queries change, update `Utils.parseSearchQuery()`, `Data.process()`, `UI.sortOptions` / `UI.screenSortOptions`, and dependent controls together.
6. **Exports:** If bundle contents or drawable naming change, keep `appfilter.xml`, `icontool_commands.txt`, `_icons/` filenames, and both ZIP flows synchronized.
7. **Accessibility:** Give new interactive elements `tabindex`, `role`, menu/keyboard handling, and guarded tooltip/image fallbacks.

## 5. Coding Standards

Formatting:
- CSS uses M3-style tokens in `:root` (`--primary`, `--surface`, `--surface-container-*`, `--outline`, `--chart-*`); there is no `md-sys-` prefix.
- Typography uses `rem` units for accessibility.
- `deno.json` configures `src/` formatting: 2 spaces, single quotes, 80-column width.

Naming Conventions:
- **Namespaces:** PascalCase top-level objects (`App`, `Utils`, `Templates`, `Components`, `Actions`, `Data`, `UI`).
- **Functions:** camelCase (e.g. `createListRow`, `loadGraphData`).
- **Templates:** camelCase (e.g. `Templates.gridCard`).
- **CSS Classes:** kebab-case (e.g. `list-row`, `status-wip`).

Error Handling:
- Use `Components.Toast.show(message, 'error')` for user-facing issues.
- Use `Data.fetchJson(url, fallback)` for non-critical JSON; route image failures through `Utils.handleImageError()` or guarded fallbacks.
- Keep `Data.fetchJson()` and optional-load `catch` blocks from surfacing fatal errors to users.

## 6. Testing & Validation

- **Type checks:** `// @ts-check` + JSDoc; validate with `deno check src/script.js` (or VS Code's JS type checker) when Deno is available.
- **Local runtime:** serve `src/` over HTTP; opening `index.html` as `file://` will break `fetch()`.
- **Manual Validation:**
  - Confirm first rows appear before graph/XML requests; confirm deep links that need graphs still wait for them.
  - Verify shift-click range selection and keyboard selection in list and grid views.
  - Verify URL restore for `q`, `view`, `sort`, `regex`, `filters`, `page`, and `tab`.
  - Verify plain search, invalid regex, `scr-N`, and graph-backed domain regex queries.
  - Verify deferred data refresh preserves selection, already-rendered rows, and scroll position.
  - Verify screens view sorting, home-screen cards/images, and tab switching.
  - Verify low-quality badge, contribution plan persistence/import, and icon-review linting.
  - Verify ZIP contents for both flows (`new` and `link` in the selection flow) and matching filenames in `_icons/`, `appfilter.xml`, and `icontool_commands.txt`.
  - Verify popovers, horizontal scroll, and touch targets below 640px.

## 7. Configuration & Environment

- **Primary data:** `requests.json`.
- **Filters:** `CONFIG.data.filters` defines load and display order; each filter needs a JSON file except synthesized `plan` and computed `unlabeled`.
- **Analytics:** `sets_stats.json` (popularity), `domain_stats.json` (domain card/tooltips), `activity_stats.json` (activity card), `iconsyouneedmost.json` (priority chart/points sort), `fulfillment_history.json` (icons/day, TTF), `trending_baseline.json` (trending sort), `review_issues.json` (QA badge/page).
- **Graphs:** `requests_graph.json` and `screens_graph.json` power geo prefixes, screen searches, and regex domain matching.
- **Local UI persistence:** `localStorage` keys `lawnicons_contribution*`; selected rows are runtime-only.
- **URL:** query parameters listed in section 2 act as environment state.
- **Static hosting:** Vercel; `public/` contains `robots.txt` and `sitemap.xml`; cache headers live in `src/vercel.json`.

## 8. Decision Priorities

1. **Simplicity:** Prefer readable vanilla JS over clever abstractions.
2. **Performance:** Keep the common first paint independent of heavy datasets; maintain smooth 60fps scrolling.
3. **Determinism:** The same URL (plus `localStorage` contribution state) must yield the same UI state.
4. **Developer Experience:** Keep JSDoc/types accurate so contributors can work without a framework.

## 9. Known Pitfalls

- **DOM collisions:** Full `innerHTML` reset is acceptable at the start of `UI.render()`, but incremental growth must go through `loadMore()` and a `DocumentFragment`.
- **Event delegation:** Use `e.target.closest()` carefully across SVG/icon children, popover items, and dynamically inserted tool pages.
- **Mode coupling:** Regex/special queries and screens/home-screen views share the same render path; keep control visibility, `App.state`, URL state, and `needsGraphData` in sync.
- **Filter data shape:** Filter entries may be strings or objects; assuming one shape silently drops `existing_drawable`.
- **Regex:** Wrap `new RegExp(...)` in `try/catch`; invalid input must not crash `Data.process()`.
- **Deferred refresh:** Re-rendering after background loads must restore `renderedCount` and scroll; avoid per-dataset renders.
- **Missing files are intentional:** `plan.json` and `creation_odds.json` do not exist; `plan` is synthesized and `unlabeled` is computed.
- **ZIP dependency:** `fflate` is loaded by a script tag on first export; always `await loadFflate()` before using it.
- **Persistence:** Contribution plan comes from `localStorage`; clearing it changes the `plan` tag and badges even if the URL is unchanged.

## 10. Contribution Boundaries

Allowed:
- UI polish and M3 alignment.
- New local-only Python scripts for data cleaning and QA.
- New filter definitions: add the ID to `CONFIG.data.filters`, provide `assets/filters/<id>.json`, and update metadata/UI labels.

Requires explicit approval:
- Adding new heavy JS dependencies or reintroducing CDN-blocking startup scripts.
- Adding nested data structures to `requests.json`.
- Changing the core `Data.process()` loop, loading phases, or the ZIP file contract.
