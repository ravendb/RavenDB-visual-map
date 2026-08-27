// Hand-placed layout for the macro view: a deliberate layered diagram
// (clients -> HTTP -> core -> {indexing, storage, cluster, ongoing tasks})
// reads far better than a generic force/grid layout at this size, and needs no
// extra dependency (dagre/elk).

// Columns are 300px apart and rows at least 170px apart, while a node card is
// 220px wide - wide enough that no two cards' bounding boxes come close to
// overlapping, so an unrelated node never sits directly in the way of an
// orthogonal edge that merely passes near its column.
export const MACRO_POSITIONS: Record<string, { x: number; y: number }> = {
  // clients
  client: { x: 300, y: 0 },
  studio: { x: 900, y: 0 },
  // front door
  security: { x: 600, y: 170 },
  http: { x: 600, y: 300 },
  // Storages is permanently expanded (see MapNode's `permanent` flag) at 8
  // children/2 columns, so its card is always ~330 tall (x:441-979,
  // y:450-782 at the position below) - queries and subscriptions sit up
  // here, out of that card's way, rather than sharing Storages' row. Its own
  // y is pushed well past the usual 510 so an edge label between it and the
  // http row above (e.g. "routes to") has room to sit above its top edge
  // instead of overlapping the card border.
  'core-queries': { x: 1220, y: 300 },
  'core-subscriptions': { x: 1860, y: 300 },
  sharding: { x: 0, y: 510 },
  'documents-core': { x: 600, y: 570 },
  etl: { x: 1260, y: 510 },
  integrations: { x: 1560, y: 510 },
  sinks: { x: 1860, y: 510 },
  // subsystems fed by the core - the whole row (plus TransactionMerger,
  // directly beneath Storages) is nudged down from the usual 700 to clear
  // Storages' permanently-expanded card (bottom edge at y:782) with enough
  // margin for an edge label in between, not just the card's raw height.
  ai: { x: 0, y: 840 },
  indexing: { x: 300, y: 840 },
  'core-tx-merger': { x: 600, y: 840 },
  cluster: { x: 960, y: 840 },
  backup: { x: 1560, y: 840 },
  replication: { x: 1560, y: 1020 },
  // engines and the layer everything persists through - nudged down by the
  // same amount as the row above, to keep the same relative spacing.
  // Search Engines is also permanently expanded (2 children: Corax, Lucene), ~160 tall.
  'search-engines': { x: 300, y: 1030 },
  storage: { x: 800, y: 1030 },
  infra: { x: 800, y: 1210 },
}

const MICRO_COLUMNS = 3
const MICRO_COL_WIDTH = 260
const MICRO_ROW_HEIGHT = 140

export function microGridPosition(index: number): { x: number; y: number } {
  const col = index % MICRO_COLUMNS
  const row = Math.floor(index / MICRO_COLUMNS)
  return { x: col * MICRO_COL_WIDTH, y: row * MICRO_ROW_HEIGHT }
}
