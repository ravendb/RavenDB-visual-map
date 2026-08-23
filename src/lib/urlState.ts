// Serializes "what's currently open on the map" into the URL hash, and parses
// it back - so a node or a flow step can be shared as a plain link and
// restored on load. Hash-only (never touches pathname/search) because the
// app is a static single-page site (GitHub Pages) with no server-side route
// to match against.

export interface MapUrlState {
  /** The macro or micro node id currently selected/opened, if any. */
  nodeId: string | null
  /** The active flow's id, if a flow is playing (mutually exclusive with nodeId). */
  flowId: string | null
  /** 1-based step number within the flow, when flowId is set. */
  step: number | null
}

const EMPTY_STATE: MapUrlState = { nodeId: null, flowId: null, step: null }

export function parseUrlHash(hash: string): MapUrlState {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw) return EMPTY_STATE
  // A bare token with no `=` is the common case - just a node id
  // (`#storage`) - kept free of query-string noise for the shareable URLs
  // this is mainly meant to produce. A flow step needs more than one field,
  // so it falls back to key=value pairs.
  if (!raw.includes('=')) {
    try {
      return { ...EMPTY_STATE, nodeId: decodeURIComponent(raw) }
    } catch {
      return EMPTY_STATE
    }
  }
  const params = new URLSearchParams(raw)
  const step = params.get('step')
  return {
    nodeId: params.get('node'),
    flowId: params.get('flow'),
    step: step ? Number(step) : null,
  }
}

export function buildUrlHash(state: MapUrlState): string {
  if (state.flowId) {
    return `#${new URLSearchParams({ flow: state.flowId, step: String(state.step ?? 1) }).toString()}`
  }
  if (state.nodeId) {
    return `#${encodeURIComponent(state.nodeId)}`
  }
  return ''
}
