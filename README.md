# RavenDB Architecture Map

An interactive, web-based architecture map of [ravendb/ravendb](https://github.com/ravendb/ravendb). A picture of RavenDB's internal layout. Click into any piece to see its structure. See the source on GitHub or export the current view to an image.
This is a static site.

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

- **Macro view**: the top-level subsystems (Client SDK, Search Engines, Clustering etc.), laid out to show data flow between them. The set of subsystems deliberately follows how the [official documentation](https://github.com/ravendb/docs) 
- **Micro view**: double-click (or use "Open micro view" in the side panel) on a node with children to drill into its internal components. 
- **Detail panel**: clicking any node opens a side panel with its summary, a link to that path in `ravendb/ravendb` on GitHub, a link to the relevant documentation.
- **Search**: find any component by name from the toolbar.
- **Flows**: walks a request/data flow across the nodes it actually touches.


## Extending the content

Everything about the map's content lives in one file: [`src/data/architecture.ts`](src/data/architecture.ts). Each subsystem or component is a `MapNode` (id, category, summary, `githubPath`, an optional `docsUrl`, and an optional `codeRef` for an inline preview); relationships between macro nodes are `MapEdge`s. To add a node, add an entry to the `nodes` array (and a position in [`src/lib/layout.ts`](src/lib/layout.ts) if it's a new macro node); to break an existing node down further, add children with `parentId` set to its id.

`npm run validate:content` ([`scripts/validate-content.ts`](scripts/validate-content.ts)) checks the map against the real repository and fails on anything that has drifted:

- every `githubPath` exists on `REF`;
- every `codeRef` file exists, and the line `startLine` points at actually contains `codeRef.expectSymbol` (usually the type declaration) - so **a line number can never rot silently**; a `codeRef` without an `expectSymbol` is itself an error;
- node ids are unique, `parentId` resolves, edges connect existing macro nodes, every macro node has exactly one layout position and no two share a position;
- every pair of consecutive flow steps is connected by a real edge.

It runs in CI on every push and pull request, plus weekly on a schedule ([`.github/workflows/validate-content.yml`](.github/workflows/validate-content.yml)) - the scheduled run is the one that catches upstream moving without anyone touching this repo.

The map is pinned to one branch of the server repo (`REF` in `architecture.ts`, currently `v7.2`). Paths and line numbers are machine-verified against that ref, but *prose is not*.

## Deployment

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main` (enable Pages → "GitHub Actions" as the source in the repo settings once this is merged). It will be served at `https://ravendb.github.io/RavenDB-visual-map/` - if you fork or rename the repo, update `base` in `vite.config.ts` to match.

