# RavenDB Architecture Map

An interactive, web-based architecture map of [ravendb/ravendb](https://github.com/ravendb/ravendb) - built for RavenDB-27197 ("Visual RavenDB Map"). It gives both engineers and non-technical stakeholders a picture of RavenDB's internal layout (storage engine, clustering, indexing, sharding, replication, AI/vector search, ...), lets you click into any piece to see its structure and jump straight to the real source on GitHub, and can export the current view to an image.

## Running it

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

```bash
npm run build             # production build, also type-checks
npm run lint              # oxlint
npm run validate:content  # check every path / line number against ravendb/ravendb
```

## How it works

- **Macro view**: the top-level subsystems (Client SDK, HTTP layer, Sharding, Document Database Core, Attachments, Indexing, Search Engines, AI & Vector Search, Storage Engine, Clustering, Replication, Backup & Restore, ETL & Integrations, Security, Studio, low-level Infra), laid out to show real data flow between them. The set of subsystems deliberately follows how the [official documentation](https://github.com/ravendb/docs) splits RavenDB into areas, so a reader who knows the docs finds the same map here.
- **Micro view**: double-click (or use "Open micro view" in the side panel) on a node with children to drill into its internal components. Every macro node except Client SDK, Studio and Infra has a breakdown.
- **Detail panel**: clicking any node opens a side panel (half the window width, so code previews have room to breathe) with its summary, a link straight to that path in `ravendb/ravendb` on GitHub, a link to the relevant documentation article where one exists, and - for nodes that point at a specific file - an inline preview of the real, live source fetched from `raw.githubusercontent.com` with the relevant lines highlighted. The graph re-centers the selected node in whatever space is left once the panel is open.
- **Search**: jump straight to any component by name from the toolbar, regardless of which view is currently open.
- **Flows**: the "Show a flow…" picker in the toolbar walks a request/data flow (document write, auto-indexing, a request against a sharded database, embeddings & vector search, a cluster-wide Raft operation, document replication, ETL export, periodic backup) across the macro nodes it actually touches - the whole tile lights up (not just its border) for the current and already-visited steps, with the traversed edges animated. Step forward/back yourself with the Previous/Next buttons on the flow banner, at your own pace. Flows are defined in [`src/data/flows.ts`](src/data/flows.ts) and each consecutive pair of steps must be connected by a real edge - `npm run validate:content` fails otherwise, so a flow can never imply a relationship the map doesn't show. Works in both 2D and 3D.
- **2D / 3D toggle**: the same node cards, at the same X/Y positions as the 2D diagram (via React Flow), can also be viewed in a real CSS 3D scene - depth (Z) is derived from each node's Y position so the layered architecture reads as receding into the view. It's a rigid, fixed layout (not a physics simulation) - drag to orbit, scroll to zoom, "Reset view" to reframe. Both views share selection, drill-down, search, and theme. The 3D scene and the syntax-highlighted code preview are loaded on demand, so opening the map in 2D doesn't pay for either.
- **Export**: the Export PNG / Export SVG buttons in the toolbar are always available in 2D and capture the graph exactly as it's currently rendered - whatever drill level, pan, zoom, or node selection is active - not a fixed default view. In 3D, only PNG export is available since an SVG doesn't preserve the 3D perspective.
- **Dark / light mode**: dark by default, toggle in the toolbar, preference remembered across visits.

No backend: this is a static site. `raw.githubusercontent.com` is called directly from the browser for the inline previews (the `ravendb/ravendb` repo is public), so hosting is just static files (see the GitHub Pages workflow below).

## Extending the content

Everything about the map's content lives in one file: [`src/data/architecture.ts`](src/data/architecture.ts). Each subsystem or component is a `MapNode` (id, category, summary, `githubPath`, an optional `docsUrl`, and an optional `codeRef` for an inline preview); relationships between macro nodes are `MapEdge`s. To add a node, add an entry to the `nodes` array (and a position in [`src/lib/layout.ts`](src/lib/layout.ts) if it's a new macro node); to break an existing node down further, add children with `parentId` set to its id.

### Content is validated, not trusted

`npm run validate:content` ([`scripts/validate-content.ts`](scripts/validate-content.ts)) checks the map against the real repository and fails on anything that has drifted:

- every `githubPath` exists on `REF`;
- every `codeRef` file exists, and the line `startLine` points at actually contains `codeRef.expectSymbol` (usually the type declaration) - so **a line number can never rot silently**; a `codeRef` without an `expectSymbol` is itself an error;
- node ids are unique, `parentId` resolves, edges connect existing macro nodes, every macro node has exactly one layout position and no two share a position;
- every pair of consecutive flow steps is connected by a real edge.

It runs in CI on every push and pull request, plus weekly on a schedule ([`.github/workflows/validate-content.yml`](.github/workflows/validate-content.yml)) - the scheduled run is the one that catches upstream moving without anyone touching this repo. It needs one GitHub API request in total (it fetches the whole tree at once), and `GITHUB_TOKEN` only to raise the rate limit. Behind a rate-limited IP you can validate fully offline against a local clone:

```bash
git clone --filter=blob:none --no-checkout --depth 1 -b v7.2 \
  https://github.com/ravendb/ravendb.git /tmp/ravendb
RAVENDB_REPO_DIR=/tmp/ravendb npm run validate:content
```

### Content-accuracy caveat

The map is pinned to one branch of the server repo (`REF` in `architecture.ts`, currently `v7.2`). Paths and line numbers are machine-verified against that ref, but **prose is not**: nodes whose summary/description were written from folder structure plus general RavenDB knowledge, without a subsystem-expert pass, carry `needsReview: true` and show a warning in the detail panel. `npm run validate:content` prints how many are left. If your team is already running the `ravendb-kb` review process, the same discipline applies here: an expert in a given subsystem should check its node(s) against the real code and clear the flag.

## Deployment

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main` (enable Pages → "GitHub Actions" as the source in the repo settings once this is merged). It will be served at `https://ravendb.github.io/RavenDB-visual-map/` - if you fork or rename the repo, update `base` in `vite.config.ts` to match.

## Known limitations

- Prose on nodes marked `needsReview: true` has not been checked by a subsystem expert yet - see the caveat above.
- The inline preview fetches from `raw.githubusercontent.com`, which is rate-limited per IP; if a fetch fails, the panel falls back to a plain "View on GitHub" link. Fetched files are cached in `localStorage` to minimize repeat calls.
- `REF` is a single hardcoded branch - there is no version switcher, so the map shows one RavenDB version at a time.
