// Hand-placed layout for the macro view: with only ~11 nodes, a deliberate
// layered diagram (client -> http -> core -> {storage, indexing, cluster, ...})
// reads far better than a generic force/grid layout, and needs no extra
// dependency (dagre/elk) for this size of graph.

export const MACRO_POSITIONS: Record<string, { x: number; y: number }> = {
  client: { x: 40, y: 0 },
  studio: { x: 440, y: 0 },
  security: { x: 240, y: 110 },
  http: { x: 240, y: 220 },
  'documents-core': { x: 240, y: 360 },
  attachments: { x: 560, y: 360 },
  indexing: { x: 20, y: 520 },
  storage: { x: 260, y: 560 },
  cluster: { x: 520, y: 520 },
  integrations: { x: 780, y: 360 },
  infra: { x: 260, y: 700 },
}

const MICRO_COLUMNS = 3
const MICRO_COL_WIDTH = 260
const MICRO_ROW_HEIGHT = 140

export function microGridPosition(index: number): { x: number; y: number } {
  const col = index % MICRO_COLUMNS
  const row = Math.floor(index / MICRO_COLUMNS)
  return { x: col * MICRO_COL_WIDTH, y: row * MICRO_ROW_HEIGHT }
}
