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
  http: { x: 600, y: 340 },
  // per-database core and what hangs directly off it. Attachments sits a row
  // higher than the ongoing-task column on the right so the core's edges to
  // ETL / backup / replication don't have to pass through its card.
  attachments: { x: 1220, y: 340 },
  sharding: { x: 0, y: 510 },
  'documents-core': { x: 600, y: 510 },
  etl: { x: 1260, y: 510 },
  integrations: { x: 1560, y: 510 },
  sinks: { x: 1860, y: 510 },
  // subsystems fed by the core
  ai: { x: 0, y: 700 },
  indexing: { x: 300, y: 700 },
  cluster: { x: 960, y: 700 },
  backup: { x: 1560, y: 700 },
  replication: { x: 1560, y: 880 },
  // engines and the layer everything persists through
  'search-engines': { x: 300, y: 890 },
  storage: { x: 800, y: 890 },
  infra: { x: 800, y: 1070 },
}

const MICRO_COLUMNS = 3
const MICRO_COL_WIDTH = 260
const MICRO_ROW_HEIGHT = 140

export function microGridPosition(index: number): { x: number; y: number } {
  const col = index % MICRO_COLUMNS
  const row = Math.floor(index / MICRO_COLUMNS)
  return { x: col * MICRO_COL_WIDTH, y: row * MICRO_ROW_HEIGHT }
}
