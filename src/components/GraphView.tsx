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
import { assignLanes, type Box } from '../lib/edgeRouting'
import MapNode, { type MapNodeData } from './MapNode'

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
// measurement race. Cards only carry a tag + one-line label, not a summary.
// Default column count - MapNode.childColumns overrides this per node (see
// e.g. Search Engines, stacked in a single column instead of a 2-wide grid).
const CHILD_COLS = 2
const CHILD_CARD_WIDTH = 250
const CHILD_CARD_HEIGHT = 48
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
  flowNodeIds: Set<string>
  flowHighlightChildId: string | null
  selectedEdgeId: string | null
  onSelectNode: (id: string) => void
  onToggleExpand: (id: string) => void
  onDeselect: () => void
  onSelectEdge: (id: string) => void
  onDeselectEdge: () => void
}

function nodeCenter(pos: { x: number; y: number }) {
  return { x: pos.x + NODE_WIDTH / 2, y: pos.y + NODE_HEIGHT / 2 }
}

// How big an expanded node grows to fit its children grid, and where it sits
// so it grows outward from its own center rather than only to one side.
function expandedSize(childCount: number, childColumns: number): { width: number; height: number } {
  const cols = Math.min(childColumns, Math.max(childCount, 1))
  const rows = Math.max(1, Math.ceil(childCount / childColumns))
  const width = EXPANDED_PADDING * 2 + cols * CHILD_CARD_WIDTH + (cols - 1) * CHILD_GAP
  const height = EXPANDED_HEADER_HEIGHT + EXPANDED_PADDING + rows * CHILD_CARD_HEIGHT + (rows - 1) * CHILD_GAP
  return { width: Math.max(width, NODE_WIDTH), height }
}

function expandedPosition(nodeId: string, size: { width: number; height: number }) {
  const center = nodeCenter(MACRO_POSITIONS[nodeId] ?? { x: 0, y: 0 })
  return { x: center.x - size.width / 2, y: center.y - size.height / 2 }
}

// The box an edge actually has to route around: a permanently-expanded
// node's real (often much larger) footprint, or the standard card size for
// everything else. Only permanent nodes need this - a click-to-expand node
// reverts to the standard size the moment nothing else is selected, and
// assignLanes/pickSides run once per render off the static layout, not off
// that transient state.
function nodeBox(nodeId: string): Box {
  const pos = MACRO_POSITIONS[nodeId] ?? { x: 0, y: 0 }
  const node = getNode(nodeId)
  if (node?.permanent) {
    const children = getChildren(nodeId)
    if (children.length > 0) {
      const size = expandedSize(children.length, node.childColumns ?? CHILD_COLS)
      return { ...expandedPosition(nodeId, size), ...size }
    }
  }
  return { x: pos.x, y: pos.y, width: NODE_WIDTH, height: NODE_HEIGHT }
}

function buildFlowElements(
  expandedNodeId: string | null,
  selectedNodeId: string | null,
  theme: Theme,
  flowCurrentNodeId: string | null,
  flowVisitedNodeIds: Set<string>,
  flowVisitedEdgeIds: Set<string>,
  flowNodeIds: Set<string>,
  flowHighlightChildId: string | null,
  selectedEdgeId: string | null,
): { flowNodes: Node<MapNodeData>[]; flowEdges: Edge[] } {
  const selectedEdge = selectedEdgeId ? allEdges.find((e) => e.id === selectedEdgeId) : undefined
  function flowState(id: string): 'current' | 'visited' | undefined {
    if (id === flowCurrentNodeId) return 'current'
    if (flowVisitedNodeIds.has(id)) return 'visited'
    return undefined
  }
  // While a flow is playing (and nothing is expanded - the two treatments
  // never overlap, see the flow guard in onNodeClick below), everything the
  // flow doesn't touch fades into the background, like the expand spotlight above.
  const isFlowActive = Boolean(flowCurrentNodeId) && !expandedNodeId

  const macro = allNodes.filter((n) => !n.parentId)
  const colors = THEME_COLORS[theme]
  const macroIds = macro.map((n) => n.id)
  const { edgeAnchors, nodeHandles } = assignLanes(allEdges, macroIds, nodeBox)

  const flowNodes: Node<MapNodeData>[] = macro.map((n) => {
    const children = getChildren(n.id)
    const permanent = n.permanent === true
    const isExpanded = (n.id === expandedNodeId || permanent) && children.length > 0
    const childColumns = n.childColumns ?? CHILD_COLS
    const size = isExpanded ? expandedSize(children.length, childColumns) : { width: NODE_WIDTH, height: NODE_HEIGHT }
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
        flowState: flowState(n.id),
        handles: nodeHandles.get(n.id),
        expanded: isExpanded,
        permanent,
        childColumns,
        // Push everything but the expanded node - or, during a flow, everything
        // the flow doesn't touch - into the background, like a spotlight. A
        // selected edge does the same for its own two endpoints, taking
        // priority over the other two (mutually exclusive - see App.tsx) and,
        // unlike the other two spotlights, not exempting permanent nodes -
        // Storages should dim like anything else when it isn't one of the
        // two tiles this particular connection is actually about.
        // Permanent nodes are otherwise exempt: they stay in focus regardless
        // of what else is expanded, the same way they're never the thing
        // being dimmed.
        dimmed: selectedEdge
          ? n.id !== selectedEdge.source && n.id !== selectedEdge.target
          : expandedNodeId
            ? n.id !== expandedNodeId && !permanent
            : isFlowActive && !flowNodeIds.has(n.id),
        selectedChildId: isExpanded ? selectedNodeId ?? undefined : undefined,
        // Only the step's own current node lights up its named child - not every
        // node the flow happens to also visit at other steps.
        flowHighlightChildId: isExpanded && n.id === flowCurrentNodeId ? flowHighlightChildId ?? undefined : undefined,
        children: isExpanded
          ? children.map((c) => ({
              id: c.id,
              label: c.label,
              category: c.category,
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
    // Mirrors the node dimming above: with an edge selected, only that one
    // edge stays in focus; with a node expanded, only edges touching it do;
    // with a flow playing, only edges that connect two nodes the flow
    // actually visits do.
    const inFocus = selectedEdge
      ? e.id === selectedEdge.id
      : expandedNodeId
        ? e.source === expandedNodeId || e.target === expandedNodeId
        : !isFlowActive || (flowNodeIds.has(e.source) && flowNodeIds.has(e.target))
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      selected: e.id === selectedEdgeId,
      ...edgeAnchors.get(e.id),
      type: 'smoothstep',
      label: e.label,
      animated: isFlowEdge,
      style: { stroke: edgeColor, strokeWidth: isFlowEdge ? 2.5 : 1.5, opacity: inFocus ? (isFlowEdge ? 1 : 0.8) : 0.1 },
      markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 14, height: 14 },
      labelStyle: {
        fill: isFlowEdge ? FLOW_ACCENT : colors.edgeLabel,
        fontSize: 11,
        fontWeight: isFlowEdge ? 700 : 500,
        opacity: inFocus ? 1 : 0.25,
      },
      labelBgStyle: { fill: colors.labelBg, fillOpacity: inFocus ? 0.92 : 0.25 },
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
    flowNodeIds,
    flowHighlightChildId,
    selectedEdgeId,
    onSelectNode,
    onToggleExpand,
    onDeselect,
    onSelectEdge,
    onDeselectEdge,
  },
  ref,
) {
  const { flowNodes, flowEdges } = useMemo(
    () =>
      buildFlowElements(
        expandedNodeId,
        selectedNodeId,
        theme,
        flowCurrentNodeId,
        flowVisitedNodeIds,
        flowVisitedEdgeIds,
        flowNodeIds,
        flowHighlightChildId,
        selectedEdgeId,
      ),
    [
      expandedNodeId,
      selectedNodeId,
      theme,
      flowCurrentNodeId,
      flowVisitedNodeIds,
      flowVisitedEdgeIds,
      flowNodeIds,
      flowHighlightChildId,
      selectedEdgeId,
    ],
  )
  const colors = THEME_COLORS[theme]
  const { setCenter, fitView, fitBounds } = useReactFlow()

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
    // Step the camera along with flow playback, so the reader's focus moves
    // with the highlighted step instead of them having to hunt for it across
    // a map that's mostly dimmed out.
    if (!flowCurrentNodeId) return
    const center = nodeCenter(MACRO_POSITIONS[flowCurrentNodeId] ?? { x: 0, y: 0 })
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setCenter(center.x, center.y, { zoom: 0.9, duration: 500 })
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [flowCurrentNodeId, setCenter])

  useEffect(() => {
    if (!highlightedNodeId) return
    // Flow playback owns the camera while it's active - this effect's deps
    // include flowNodes, which changes on every step, so without this guard
    // it would refire on a stale highlightedNodeId left over from before the
    // flow started and steal the camera from the flow's own centering effect.
    if (flowCurrentNodeId) return
    // A child node isn't its own React Flow node - it only exists inside its
    // expanded parent's box - so center on that parent instead.
    const targetId = getNode(highlightedNodeId)?.parentId ?? highlightedNodeId
    // The expand effect above already frames this same node (at a zoom that
    // accounts for its grown size) - without this guard both effects fire on
    // the same click and race to setCenter, and this one always wins last.
    if (targetId === expandedNodeId) return
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
  }, [highlightedNodeId, expandedNodeId, flowCurrentNodeId, flowNodes, setCenter])

  useEffect(() => {
    if (!selectedEdgeId) return
    const edge = allEdges.find((e) => e.id === selectedEdgeId)
    if (!edge) return
    const sourceNode = flowNodes.find((n) => n.id === edge.source)
    const targetNode = flowNodes.find((n) => n.id === edge.target)
    if (!sourceNode || !targetNode) return
    const sourceWidth = (sourceNode.width as number | undefined) ?? NODE_WIDTH
    const sourceHeight = (sourceNode.height as number | undefined) ?? NODE_HEIGHT
    const targetWidth = (targetNode.width as number | undefined) ?? NODE_WIDTH
    const targetHeight = (targetNode.height as number | undefined) ?? NODE_HEIGHT
    const minX = Math.min(sourceNode.position.x, targetNode.position.x)
    const minY = Math.min(sourceNode.position.y, targetNode.position.y)
    const maxX = Math.max(sourceNode.position.x + sourceWidth, targetNode.position.x + targetWidth)
    const maxY = Math.max(sourceNode.position.y + sourceHeight, targetNode.position.y + targetHeight)
    // Same settle-then-fit timing as the effects above - the panel opening
    // resizes the canvas via flexbox first, and fitBounds needs that resize
    // to have already landed for its math to frame the right space.
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        fitBounds({ x: minX, y: minY, width: maxX - minX, height: maxY - minY }, { padding: 0.35, duration: 400 })
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [selectedEdgeId, flowNodes, fitBounds])

  return (
    <div className="graph-view" ref={ref}>
      <ReactFlow
        colorMode={theme}
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={(event, node) => {
          // The parent card and every child tile carry their own close (x).
          // For a node with children, that collapses its expanded view (same
          // as clicking the pane background does); for a childless node -
          // which never expands - it just deselects it instead.
          if ((event.target as HTMLElement).closest('[data-node-close]')) {
            if (getChildren(node.id).length > 0) onToggleExpand(node.id)
            else onDeselect()
            return
          }
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
          // any other expandable tile) collapses it. Not while a flow is
          // playing though - the expand/dim treatment competes visually with
          // the flow's own dimming, and every tile should stay clickable for
          // its detail without knocking the flow off track. A permanent node
          // is already expanded and never collapses, so there's nothing to
          // toggle - doing it anyway would still churn expandedNodeId and
          // wrongly dim the *other* permanent node while this one is focused.
          if (getChildren(node.id).length > 0 && !flowCurrentNodeId && !getNode(node.id)?.permanent) onToggleExpand(node.id)
        }}
        onEdgeClick={(_, edge) => {
          // A flow's own edges are already spoken for by its playback -
          // clicking one to open an unrelated detail panel would fight the
          // flow's dimming/camera for the same screen.
          if (flowCurrentNodeId) return
          onSelectEdge(edge.id)
        }}
        onPaneClick={() => {
          if (expandedNodeId) onToggleExpand(expandedNodeId)
          if (selectedEdgeId) onDeselectEdge()
        }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2}
        // The layout is hand-placed, not user-arranged, and there's no
        // onConnect - so without these, a drag started near a card's edge
        // (every card has invisible lane handles covering its border) begins
        // a phantom connection gesture instead of panning the canvas.
        nodesDraggable={false}
        nodesConnectable={false}
        // Selection is our own concern (the `selected` prop each node/edge
        // gets above, driven by selectedNodeId/expandedNodeId) - without
        // this, React Flow's default "selectable" behavior still marks
        // every edge with its own cursor: pointer even though clicking one
        // does nothing here, which reads as a broken affordance.
        elementsSelectable={false}
      >
        <Background gap={24} color={colors.dot} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={colors.minimapNode} maskColor={colors.minimapMask} />
      </ReactFlow>
    </div>
  )
})

export default GraphView
