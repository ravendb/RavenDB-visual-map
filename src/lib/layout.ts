// Hand-placed layout for the macro view: with only ~11 nodes, a deliberate
// layered diagram (client -> http -> core -> {storage, indexing, cluster, ...})
// reads far better than a generic force/grid layout, and needs no extra
// dependency (dagre/elk) for this size of graph.

// X spacing is wide enough that no two cards' bounding boxes come close to
// overlapping (each is 220px wide) - otherwise an unrelated node can end up
// sitting directly in the way of an orthogonal edge that merely passes near
// its column on the way to some other target.
export const MACRO_POSITIONS: Record<string, { x: number; y: number }> = {
  client: { x: 64, y: 0 },
  studio: { x: 704, y: 0 },
  security: { x: 384, y: 130 },
  http: { x: 384, y: 260 },
  'documents-core': { x: 384, y: 430 },
  attachments: { x: 896, y: 430 },
  indexing: { x: 32, y: 620 },
  storage: { x: 416, y: 660 },
  cluster: { x: 832, y: 620 },
  integrations: { x: 1248, y: 430 },
  infra: { x: 416, y: 850 },
}

const MICRO_COLUMNS = 3
const MICRO_COL_WIDTH = 260
const MICRO_ROW_HEIGHT = 140

export function microGridPosition(index: number): { x: number; y: number } {
  const col = index % MICRO_COLUMNS
  const row = Math.floor(index / MICRO_COLUMNS)
  return { x: col * MICRO_COL_WIDTH, y: row * MICRO_ROW_HEIGHT }
}
