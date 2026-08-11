# RavenDB Architecture Map

An interactive, web-based architecture map of [ravendb/ravendb](https://github.com/ravendb/ravendb) - built for RavenDB-27197 ("Visual RavenDB Map"). It gives both engineers and non-technical stakeholders a picture of RavenDB's internal layout (storage engine, clustering, indexing, attachments, ...), lets you click into any piece to see its structure and jump straight to the real source on GitHub, and can export the current view to an image.

## Running it

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

```bash
npm run build   # production build, also type-checks
npm run lint    # oxlint
```

## How it works

- **Macro view**: the top-level subsystems (Client SDK, HTTP layer, Document Database Core, Attachments, Indexing, Storage Engine, Clustering, ETL & Integrations, Security, Studio, low-level Infra), laid out to show real data flow between them.
- **Micro view**: double-click (or use "Open micro view" in the side panel) on a node with children to drill into its internal components. Currently fleshed out for Storage Engine, Attachments, Clustering, and Indexing - the four subsystems the ticket calls out or that map naturally to the codebase's own folder structure.
- **Detail panel**: clicking any node opens a side panel with its summary, a link straight to that path in `ravendb/ravendb` on GitHub, and - for nodes that point at a specific file - an inline preview of the real, live source fetched from `raw.githubusercontent.com` with the relevant lines highlighted.
- **Search**: jump straight to any component by name from the toolbar, regardless of which view is currently open.
- **Export**: the Export PNG / Export SVG buttons in the toolbar are always available and capture the graph exactly as it's currently rendered - whatever drill level, pan, zoom, or node selection is active - not a fixed default view.

No backend: this is a static site. GitHub's public REST/raw endpoints are called directly from the browser (the `ravendb/ravendb` repo is public), so hosting is just static files (see the GitHub Pages workflow below).

## Extending the content

Everything about the map's content lives in one file: [`src/data/architecture.ts`](src/data/architecture.ts). Each subsystem or component is a `MapNode` (id, category, summary, `githubPath`, and an optional `codeRef` for an inline preview); relationships between macro nodes are `MapEdge`s. To add a node, add an entry to the `nodes` array (and a position in [`src/lib/layout.ts`](src/lib/layout.ts) if it's a new macro node); to break an existing node down further, add children with `parentId` set to its id.

**Content-accuracy caveat**: this first pass was written from the real `ravendb/ravendb` folder structure plus general RavenDB architecture knowledge - it has *not* had a subsystem-expert review pass yet. Nodes that would most benefit from one are marked `needsReview: true` in the data file. If your team is already running the `ravendb-kb` review process, the same discipline applies here: an expert in a given subsystem should check its node(s) against the real code and clear the flag. `codeRef` line numbers must point at lines you've actually verified (e.g. via `curl <raw url> | grep -n`) - don't guess them, for the same reason `ravendb-kb` reviews exist in the first place.

## Deployment

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main` (enable Pages → "GitHub Actions" as the source in the repo settings once this is merged). It will be served at `https://ravendb.github.io/RavenDB-visual-map/` - if you fork or rename the repo, update `base` in `vite.config.ts` to match.

## Known limitations

- GitHub's unauthenticated API rate limit (60 requests/hour per IP) applies to the inline code preview fetches; if it's hit, the panel falls back to a plain "View on GitHub" link. Fetched files are cached in `localStorage` to minimize repeat calls.
- Only Storage Engine, Attachments, Clustering, and Indexing have a micro-level breakdown so far; the remaining macro nodes are one level deep. See the caveat above.
