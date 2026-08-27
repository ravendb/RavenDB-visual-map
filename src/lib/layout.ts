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
  // children in a single column, so its card is always ~565 tall and only
  // ~280 wide (x:571-849, y:464-1028 at the position below) - queries and
  // subscriptions sit up here, out of that card's way, rather than sharing
  // Storages' row. Its own y is pushed well past the usual 510 so an edge
  // label between it and the http row above (e.g. "routes to") has room to
  // sit above its top edge instead of overlapping the card border.
  'core-queries': { x: 1220, y: 300 },
  'core-subscriptions': { x: 2130, y: 300 },
  sharding: { x: 0, y: 510 },
  'documents-core': { x: 600, y: 700 },
  etl: { x: 1600, y: 510 },
  integrations: { x: 1830, y: 510 },
  sinks: { x: 2130, y: 510 },
  // subsystems fed by the core - the whole row (plus TransactionMerger,
  // directly beneath Storages) is nudged down from the usual 700 to clear
  // Storages' permanently-expanded card (bottom edge at y:1028) with enough
  // margin for an edge label in between, not just the card's raw height.
  // Cluster is also pushed right, off of Storages/ETL's shared column, so
  // the edges into it (from http and from Storages) don't bend back across
  // either card on their way there.
  ai: { x: 0, y: 1100 },
  indexing: { x: 300, y: 1100 },
  'core-tx-merger': { x: 600, y: 1100 },
  cluster: { x: 1350, y: 1100 },
  backup: { x: 1650, y: 1100 },
  replication: { x: 1650, y: 1280 },
  // engines and the layer everything persists through - nudged down by the
  // same amount as the row above, to keep the same relative spacing.
  // Search Engines is also permanently expanded (2 children: Corax, Lucene),
  // now single-column too, so ~215 tall and ~280 wide.
  'search-engines': { x: 300, y: 1290 },
  storage: { x: 950, y: 1290 },
  infra: { x: 1150, y: 1470 },
}

const MICRO_COLUMNS = 3
const MICRO_COL_WIDTH = 260
const MICRO_ROW_HEIGHT = 140

export function microGridPosition(index: number): { x: number; y: number } {
  const col = index % MICRO_COLUMNS
  const row = Math.floor(index / MICRO_COLUMNS)
  return { x: col * MICRO_COL_WIDTH, y: row * MICRO_ROW_HEIGHT }
}
