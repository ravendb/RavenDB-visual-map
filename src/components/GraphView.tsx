import { useMemo, useEffect, forwardRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Node,
  type Edge,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nodes as allNodes, edges as allEdges, getChildren, getNode } from '../data/architecture'
import { MACRO_POSITIONS } from '../lib/layout'
import type { Theme } from '../lib/theme'
import { CATEGORY_COLORS } from '../lib/categoryColors'
import MapNode, { type MapNodeData, type HandleSide, type NodeHandleSpec } from './MapNode'

const nodeTypes = { mapNode: MapNode }

const THEME_COLORS: Record<Theme, { dot: string; edge: string; edgeLabel: string; labelBg: string; minimapNode: string; minimapMask: string }> = {
  dark: { dot: '#262c47', edge: '#4a5178', edgeLabel: '#c7ccec', labelBg: '#1a2036', minimapNode: '#4a5178', minimapMask: 'rgba(15, 20, 37, 0.7)' },
  light: { dot: '#e2e8f0', edge: '#94a3b8', edgeLabel: '#33343a', labelBg: '#ffffff', minimapNode: '#94a3b8', minimapMask: 'rgba(248, 250, 252, 0.7)' },
}
// Matches the fixed width / approximate height of .map-node in App.css - given as an
// initial size hint so fitView can compute a correct transform on the very first render,
// instead of waiting on an async post-mount measurement pass.
const NODE_WIDTH = 220
const NODE_HEIGHT = 92
const FLOW_ACCENT = '#1cc8ee'

// Sizing for the children grid an expanded node grows to show - kept in sync
// with the CSS grid in App.css (.map-node__children / .map-node__child) so the
// box we tell React Flow about matches what actually renders, with no
// measurement race. Cards are wide/tall enough to carry a one-line label plus
// a short two-line summary, not just a bare name.
const CHILD_COLS = 2
const CHILD_CARD_WIDTH = 230
const CHILD_CARD_HEIGHT = 84
const CHILD_GAP = 10
const EXPANDED_PADDING = 14
const EXPANDED_HEADER_HEIGHT = 96

interface GraphViewProps {
  expandedNodeId: string | null
  selectedNodeId: string | null
  highlightedNodeId: string | null
  theme: Theme
  flowCurrentNodeId: string | null
  flowVisitedNodeIds: Set<string>
  flowVisitedEdgeIds: Set<string>
  onSelectNode: (id: string) => void
  onToggleExpand: (id: string) => void
}

// Which side an edge should leave/enter a node from, based on where the other
// node actually sits - so a same-row connection goes left/right instead of
// looping out the bottom and back in the top.
function pickSides(source: { x: number; y: number }, target: { x: number; y: number }): { sourceSide: HandleSide; targetSide: HandleSide } {
  const dx = target.x - source.x
  const dy = target.y - source.y
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? { sourceSide: 'right', targetSide: 'left' } : { sourceSide: 'left', targetSide: 'right' }
  }
  return dy > 0 ? { sourceSide: 'bottom', targetSide: 'top' } : { sourceSide: 'top', targetSide: 'bottom' }
}

function nodeCenter(pos: { x: number; y: number }) {
  return { x: pos.x + NODE_WIDTH / 2, y: pos.y + NODE_HEIGHT / 2 }
}

// How big an expanded node grows to fit its children grid, and where it sits
// so it grows outward from its own center rather than only to one side.
function expandedSize(childCount: number): { width: number; height: number } {
  const cols = Math.min(CHILD_COLS, Math.max(childCount, 1))
  const rows = Math.max(1, Math.ceil(childCount / CHILD_COLS))
  const width = EXPANDED_PADDING * 2 + cols * CHILD_CARD_WIDTH + (cols - 1) * CHILD_GAP
  const height = EXPANDED_HEADER_HEIGHT + EXPANDED_PADDING + rows * CHILD_CARD_HEIGHT + (rows - 1) * CHILD_GAP
  return { width: Math.max(width, NODE_WIDTH), height }
}

function expandedPosition(nodeId: string, size: { width: number; height: number }) {
  const center = nodeCenter(MACRO_POSITIONS[nodeId] ?? { x: 0, y: 0 })
  return { x: center.x - size.width / 2, y: center.y - size.height / 2 }
}

function handleId(side: HandleSide, offset: number) {
  return `${side}-${offset.toFixed(2)}`
}

// Several edges often leave/enter the same side of a hub node (e.g. everything
// hanging off Document Database Core). A single centered handle per side made
// them all leave from the exact same pixel and overlap for their whole first
// stretch. This spreads every side's edges evenly across it instead, and hands
// back both the per-edge handle ids and the handle specs each node needs to render.
function assignLanes(
  edges: typeof allEdges,
): { edgeAnchors: Map<string, { sourceHandle: string; targetHandle: string }>; nodeHandles: Map<string, NodeHandleSpec[]> } {
  const sides = edges.map((e) => {
    const sourcePos = MACRO_POSITIONS[e.source] ?? { x: 0, y: 0 }
    const targetPos = MACRO_POSITIONS[e.target] ?? { x: 0, y: 0 }
    const { sourceSide, targetSide } = pickSides(nodeCenter(sourcePos), nodeCenter(targetPos))
    return { edge: e, sourceSide, targetSide }
  })

  const laneGroups = new Map<string, string[]>()
  function addToLane(nodeId: string, side: HandleSide, edgeId: string) {
    const key = `${nodeId}:${side}`
    const list = laneGroups.get(key) ?? []
    list.push(edgeId)
    laneGroups.set(key, list)
  }
  sides.forEach(({ edge, sourceSide, targetSide }) => {
    addToLane(edge.source, sourceSide, edge.id)
    addToLane(edge.target, targetSide, edge.id)
  })
  // Sort each side's edge ids for a stable, deterministic lane order.
  laneGroups.forEach((list) => list.sort())

  function laneOffset(nodeId: string, side: HandleSide, edgeId: string): number {
    const list = laneGroups.get(`${nodeId}:${side}`) ?? [edgeId]
    const index = list.indexOf(edgeId)
    return ((index + 1) / (list.length + 1)) * 100
  }

  const edgeAnchors = new Map<string, { sourceHandle: string; targetHandle: string }>()
  const nodeHandles = new Map<string, NodeHandleSpec[]>()
  function ensureHandle(nodeId: string, side: HandleSide, offset: number) {
    const id = handleId(side, offset)
    const list = nodeHandles.get(nodeId) ?? []
    if (!list.some((h) => h.id === id)) list.push({ id, side, offset })
    nodeHandles.set(nodeId, list)
  }

  sides.forEach(({ edge, sourceSide, targetSide }) => {
    const sourceOffset = laneOffset(edge.source, sourceSide, edge.id)
    const targetOffset = laneOffset(edge.target, targetSide, edge.id)
    ensureHandle(edge.source, sourceSide, sourceOffset)
    ensureHandle(edge.target, targetSide, targetOffset)
    edgeAnchors.set(edge.id, { sourceHandle: handleId(sourceSide, sourceOffset), targetHandle: handleId(targetSide, targetOffset) })
  })

  return { edgeAnchors, nodeHandles }
}

function buildFlowElements(
  expandedNodeId: string | null,
  selectedNodeId: string | null,
  theme: Theme,
  flowCurrentNodeId: string | null,
  flowVisitedNodeIds: Set<string>,
  flowVisitedEdgeIds: Set<string>,
): { flowNodes: Node<MapNodeData>[]; flowEdges: Edge[] } {
  function flowState(id: string): 'current' | 'visited' | undefined {
    if (id === flowCurrentNodeId) return 'current'
    if (flowVisitedNodeIds.has(id)) return 'visited'
    return undefined
  }

  const macro = allNodes.filter((n) => !n.parentId)
  const colors = THEME_COLORS[theme]
  const { edgeAnchors, nodeHandles } = assignLanes(allEdges)

  const flowNodes: Node<MapNodeData>[] = macro.map((n) => {
    const children = getChildren(n.id)
    const isExpanded = n.id === expandedNodeId && children.length > 0
    const size = isExpanded ? expandedSize(children.length) : { width: NODE_WIDTH, height: NODE_HEIGHT }
    const position = isExpanded ? expandedPosition(n.id, size) : MACRO_POSITIONS[n.id] ?? { x: 0, y: 0 }
    return {
      id: n.id,
      type: 'mapNode',
      position,
      width: size.width,
      height: size.height,
      // Sits above its (now dimmed) neighbors instead of getting tucked behind them.
      zIndex: isExpanded ? 10 : 0,
      selected: n.id === selectedNodeId,
      data: {
        label: n.label,
        category: n.category,
        hasChildren: children.length > 0,
        needsReview: n.needsReview,
        flowState: flowState(n.id),
        handles: nodeHandles.get(n.id),
        expanded: isExpanded,
        // Push everything but the expanded node into the background, like a spotlight.
        dimmed: Boolean(expandedNodeId) && n.id !== expandedNodeId,
        selectedChildId: isExpanded ? selectedNodeId ?? undefined : undefined,
        children: isExpanded
          ? children.map((c) => ({
              id: c.id,
              label: c.label,
              category: c.category,
              summary: c.summary,
              needsReview: c.needsReview,
              hasCodeRef: Boolean(c.codeRef),
            }))
          : undefined,
      },
    }
  })

  const flowEdges: Edge[] = allEdges.map((e) => {
    const isFlowEdge = flowVisitedEdgeIds.has(e.id)
    // Color by the target's subsystem category (the same palette as the node
    // badges) so an edge visibly "belongs" to the kind of thing it leads
    // into, instead of every connection looking identical regardless of what
    // it actually connects.
    const targetCategory = getNode(e.target)?.category
    const edgeColor = isFlowEdge ? FLOW_ACCENT : targetCategory ? CATEGORY_COLORS[targetCategory] : colors.edge
    const touchesExpanded = !expandedNodeId || e.source === expandedNodeId || e.target === expandedNodeId
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      ...edgeAnchors.get(e.id),
      type: 'smoothstep',
      label: e.label,
      animated: isFlowEdge,
      style: { stroke: edgeColor, strokeWidth: isFlowEdge ? 2.5 : 1.5, opacity: touchesExpanded ? (isFlowEdge ? 1 : 0.8) : 0.1 },
      markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 14, height: 14 },
      labelStyle: {
        fill: isFlowEdge ? FLOW_ACCENT : colors.edgeLabel,
        fontSize: 11,
        fontWeight: isFlowEdge ? 700 : 500,
        opacity: touchesExpanded ? 1 : 0.25,
      },
      labelBgStyle: { fill: colors.labelBg, fillOpacity: touchesExpanded ? 0.92 : 0.25 },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
    }
  })
  // Draw the active flow's edges last so they sit on top of the static ones they overlap.
  flowEdges.sort((a, b) => Number(a.animated) - Number(b.animated))
  return { flowNodes, flowEdges }
}

const GraphView = forwardRef<HTMLDivElement, GraphViewProps>(function GraphView(
  {
    expandedNodeId,
    selectedNodeId,
    highlightedNodeId,
    theme,
    flowCurrentNodeId,
    flowVisitedNodeIds,
    flowVisitedEdgeIds,
    onSelectNode,
    onToggleExpand,
  },
  ref,
) {
  const { flowNodes, flowEdges } = useMemo(
    () => buildFlowElements(expandedNodeId, selectedNodeId, theme, flowCurrentNodeId, flowVisitedNodeIds, flowVisitedEdgeIds),
    [expandedNodeId, selectedNodeId, theme, flowCurrentNodeId, flowVisitedNodeIds, flowVisitedEdgeIds],
  )
  const colors = THEME_COLORS[theme]
  const { setCenter, fitView } = useReactFlow()

  useEffect(() => {
    // includeHiddenNodes makes fitView bounds fall back to each node's declared
    // width/height (NODE_WIDTH/NODE_HEIGHT above) instead of requiring the async
    // ResizeObserver-based `measured` size - so the very first fit doesn't have
    // to race that measurement pass. Only needed once: expanding a node no
    // longer swaps the whole node set, so there's nothing else to re-fit for.
    fitView({ padding: 0.25, duration: 0, includeHiddenNodes: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!expandedNodeId) return
    // Frame the node that just grew - it may now overlap neighbors the
    // hand-placed macro layout never expected, so panning/zooming to it keeps
    // that overlap out of the way instead of leaving it looking like a glitch.
    const center = nodeCenter(MACRO_POSITIONS[expandedNodeId] ?? { x: 0, y: 0 })
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setCenter(center.x, center.y, { zoom: 0.85, duration: 400 })
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [expandedNodeId, setCenter])

  useEffect(() => {
    if (!highlightedNodeId) return
    // A child node isn't its own React Flow node - it only exists inside its
    // expanded parent's box - so center on that parent instead.
    const targetId = getNode(highlightedNodeId)?.parentId ?? highlightedNodeId
    const node = flowNodes.find((n) => n.id === targetId)
    if (!node) return
    const width = (node.width as number | undefined) ?? NODE_WIDTH
    const height = (node.height as number | undefined) ?? NODE_HEIGHT
    // The detail panel opening/closing resizes this container via flexbox;
    // React Flow's own resize observer needs a tick to pick that up before
    // setCenter's math is correct, so center against the settled layout
    // (a couple of frames later) rather than the just-committed one - this is
    // what keeps the selected node centered in the space left of the sidebar
    // instead of the pre-resize full width.
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setCenter(node.position.x + width / 2, node.position.y + height / 2, { zoom: 1.1, duration: 400 })
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [highlightedNodeId, flowNodes, setCenter])

  return (
    <div className="graph-view" ref={ref}>
      <ReactFlow
        colorMode={theme}
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={(event, node) => {
          // Children render as plain DOM inside their expanded parent's node
          // rather than as React Flow nodes of their own, so a click on one is
          // only distinguishable by looking at what was actually clicked.
          const childId = (event.target as HTMLElement).closest('[data-child-id]')?.getAttribute('data-child-id')
          if (childId) {
            onSelectNode(childId)
            return
          }
          onSelectNode(node.id)
          // One click both opens the detail panel and expands children in
          // place, right on the tile that was clicked - clicking it again (or
          // any other expandable tile) collapses it.
          if (getChildren(node.id).length > 0) onToggleExpand(node.id)
        }}
        onPaneClick={() => {
          if (expandedNodeId) onToggleExpand(expandedNodeId)
        }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background gap={24} color={colors.dot} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={colors.minimapNode} maskColor={colors.minimapMask} />
      </ReactFlow>
    </div>
  )
})

export default GraphView
