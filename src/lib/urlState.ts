// Serializes "what's currently open on the map" into the URL hash, and parses
// it back - so a node or a flow step can be shared as a plain link and
// restored on load. Hash-only (never touches pathname/search) because the
// app is a static single-page site (GitHub Pages) with no server-side route
// to match against.

import { getChildren, getNode } from '../data/architecture'

export interface MapUrlState {
  /** The macro or micro node id currently selected/opened, if any. */
  nodeId: string | null
  /** The macro node id whose children are currently expanded in place, if any. */
  expandedNodeId: string | null
  /** The active flow's id, if a flow is playing (expandedNodeId is unused while one is). */
  flowId: string | null
  /** 1-based step number within the flow, when flowId is set. */
  step: number | null
}

const EMPTY_STATE: MapUrlState = { nodeId: null, expandedNodeId: null, flowId: null, step: null }

// Clicking a node - see handleSelectNode in App.tsx - always expands it in
// place if it has children, or expands its parent if it's a child tile. A
// plain `#nodeId` link (no explicit `expanded` param) should reopen to that
// same default, so links written before this param existed - and the common
// case today, since most clicks produce exactly this - still round-trip as a
// short, bare id instead of always spelling out the expanded state too.
function defaultExpandedFor(nodeId: string | null): string | null {
  if (!nodeId) return null
  const node = getNode(nodeId)
  if (!node) return null
  if (node.parentId) return node.parentId
  return getChildren(nodeId).length > 0 ? nodeId : null
}

export function parseUrlHash(hash: string): MapUrlState {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw) return EMPTY_STATE
  // A bare token with no `=` is the common case - just a node id
  // (`#storage`) - kept free of query-string noise for the shareable URLs
  // this is mainly meant to produce. Anything needing more than one field
  // (a flow step, or a node whose expanded state diverges from the default
  // above) falls back to key=value pairs.
  if (!raw.includes('=')) {
    try {
      const nodeId = decodeURIComponent(raw)
      return { ...EMPTY_STATE, nodeId, expandedNodeId: defaultExpandedFor(nodeId) }
    } catch {
      return EMPTY_STATE
    }
  }
  const params = new URLSearchParams(raw)
  const nodeId = params.get('node')
  const flowId = params.get('flow')
  const step = params.get('step')
  return {
    nodeId,
    // An `expanded` param that's present but empty is an explicit "collapsed"
    // and must stick; one that's missing entirely (an older link, or a flow
    // link that never carried one) falls back to the same default a bare
    // node link uses - except while a flow is active, where the expand/dim
    // treatment never applies (see GraphView's isFlowActive) so there's no
    // sensible default to infer.
    expandedNodeId: params.has('expanded') ? params.get('expanded') || null : flowId ? null : defaultExpandedFor(nodeId),
    flowId,
    step: step ? Number(step) : null,
  }
}

export function buildUrlHash(state: MapUrlState): string {
  if (state.flowId) {
    const params: Record<string, string> = { flow: state.flowId, step: String(state.step ?? 1) }
    // Whether the flow step's own detail panel is open for a node also needs
    // to survive a reload/share, same as it would outside a flow.
    if (state.nodeId) params.node = state.nodeId
    return `#${new URLSearchParams(params).toString()}`
  }
  if (state.nodeId) {
    if (state.expandedNodeId === defaultExpandedFor(state.nodeId)) {
      return `#${encodeURIComponent(state.nodeId)}`
    }
    return `#${new URLSearchParams({ node: state.nodeId, expanded: state.expandedNodeId ?? '' }).toString()}`
  }
  if (state.expandedNodeId) {
    return `#${new URLSearchParams({ expanded: state.expandedNodeId }).toString()}`
  }
  return ''
}
