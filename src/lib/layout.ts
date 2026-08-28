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
  // y:450-782 at the position below), centered at x:710. Its own y is
  // pushed well past the usual 510 so an edge label between it and the
  // http row above (e.g. "routes to") has room to sit above its top edge
  // instead of overlapping the card border.
  sharding: { x: 0, y: 510 },
  'documents-core': { x: 600, y: 570 },
  integrations: { x: 1830, y: 510 },
  sinks: { x: 2130, y: 510 },
  // Queries, Data Subscriptions, ETL and Replication stack in one column
  // right off Storages' right edge (979) instead of scattered across the
  // diagram, so all four of Storages' "other side" connections read as one
  // group at a glance. Rows are the usual 170px apart (not the tighter
  // 150px first tried) - Storages feeds all four, and the extra room keeps
  // each connection's own label from crowding its neighbors'.
  'core-queries': { x: 1060, y: 450 },
  'core-subscriptions': { x: 1060, y: 620 },
  etl: { x: 1060, y: 790 },
  replication: { x: 1060, y: 960 },
  // subsystems fed by the core - the whole row is nudged down from the
  // usual 700 to clear Storages' permanently-expanded card (bottom edge at
  // y:782) with enough margin for an edge label in between, not just the
  // card's raw height. Cluster is also pushed right, off of Storages'
  // shared column, so the edges into it (from http and from Storages)
  // don't bend back across either card on their way there.
  ai: { x: 0, y: 900 },
  indexing: { x: 300, y: 900 },
  // Centered under Storages (x:710) - straight down via "batches writes".
  'core-tx-merger': { x: 600, y: 900 },
  cluster: { x: 1350, y: 900 },
  backup: { x: 1650, y: 900 },
  // engines and the layer everything persists through - nudged down by the
  // same amount as the row above, to keep the same relative spacing.
  // Vector Search sits directly under AI (straight down via "vector fields"),
  // left of Search Engines with room to spare.
  'vector-search': { x: 0, y: 1090 },
  // Search Engines is also permanently expanded (2 children: Corax, Lucene),
  // stacked in a single column via childColumns: 1 (~215 tall, ~280 wide) -
  // unlike Storages, which keeps the default 2-column grid.
  'search-engines': { x: 300, y: 1090 },
  // Centered under TransactionMerger (x:710, same as Storages above it) -
  // straight down via "commits via".
  storage: { x: 600, y: 1090 },
}

const MICRO_COLUMNS = 3
const MICRO_COL_WIDTH = 260
const MICRO_ROW_HEIGHT = 140

export function microGridPosition(index: number): { x: number; y: number } {
  const col = index % MICRO_COLUMNS
  const row = Math.floor(index / MICRO_COLUMNS)
  return { x: col * MICRO_COL_WIDTH, y: row * MICRO_ROW_HEIGHT }
}
