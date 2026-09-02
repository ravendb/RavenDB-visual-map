// Hand-placed layout for the macro view: a deliberate layered diagram
// (clients -> HTTP -> core -> {indexing, storage, cluster, ongoing tasks})
// reads far better than a generic force/grid layout at this size, and needs no
// extra dependency (dagre/elk).

// Columns are 300px apart and rows at least 170px apart, while a node card is
// 220px wide - wide enough that no two cards' bounding boxes come close to
// overlapping, so an unrelated node never sits directly in the way of an
// orthogonal edge that merely passes near its column.
export const MACRO_POSITIONS: Record<string, { x: number; y: number }> = {
  // clients + front door share one top row.
  client: { x: 270, y: 0 },
  security: { x: 610, y: 0 },
  studio: { x: 960, y: 0 },
  http: { x: 610, y: 140 },
  // Left column: a single stack, Sharding down through Indexing, each row
  // lined up with its opposite number in the right-hand column below
  // (sharding/backup, ai/subscriptions, indexing/sinks) so the two columns
  // read as matching horizontal rows, not just as independently-spaced stacks.
  sharding: { x: 50, y: 280 },
  // y:450 (not 430, like its row partner) lines its center up with the
  // Storages handle "embeddings tasks" actually exits from, so that edge
  // runs dead straight instead of stepping down to meet it.
  ai: { x: 50, y: 450 },
  indexing: { x: 50, y: 740 },
  // Search Engines is permanently expanded (2 children: Corax, Lucene),
  // stacked in a single column via childColumns: 1 (~216 tall, ~278 wide) -
  // centered under the Indexing column, straight down via "written through".
  'search-engines': { x: 50, y: 1030 },
  // Storages is permanently expanded (see MapNode's `permanent` flag) at 8
  // children/2 columns, so its card is always ~330 tall (x:441-979,
  // y:400-732 at the position below), centered at x:710.
  'documents-core': { x: 600, y: 520 },
  // Centered under Storages (x:710) - straight down via "batches writes",
  // and lined up with Integrations in the right column on the same row.
  'core-tx-merger': { x: 600, y: 860 },
  // Centered under TransactionMerger (x:710, same as Storages above it),
  // and lined up with Clustering to its right on the same row.
  storage: { x: 600, y: 1090 },
  // Clustering and Replication sit off to the right of the Storage Engine /
  // TransactionMerger column, side by side on the same row as Storage Engine
  // - "ACID Raft log" reads as a short straight edge between Storage Engine
  // and Clustering. Stacking Replication directly above Clustering used to
  // put both of Storages' edges into this pair on the exact same vertical
  // line, running straight through whichever of the two sat closer; sitting
  // beside each other instead gives each its own approach.
  cluster: { x: 900, y: 1090 },
  replication: { x: 1200, y: 1090 },
  // Right column: all six of Storages'/HTTP's "other side" connections
  // stack in one column off to the right, in reading order top to bottom -
  // Queries, Backup, Subscriptions, ETL, Sinks, Integrations - each one
  // lined up with its counterpart in the http/left column/TransactionMerger
  // row to its left.
  'core-queries': { x: 1260, y: 140 },
  backup: { x: 1260, y: 280 },
  'core-subscriptions': { x: 1260, y: 430 },
  etl: { x: 1260, y: 585 },
  sinks: { x: 1260, y: 740 },
  integrations: { x: 1260, y: 920 },
}

const MICRO_COLUMNS = 3
const MICRO_COL_WIDTH = 260
const MICRO_ROW_HEIGHT = 140

export function microGridPosition(index: number): { x: number; y: number } {
  const col = index % MICRO_COLUMNS
  const row = Math.floor(index / MICRO_COLUMNS)
  return { x: col * MICRO_COL_WIDTH, y: row * MICRO_ROW_HEIGHT }
}
