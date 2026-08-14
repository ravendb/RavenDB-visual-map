import { useMemo, useEffect, forwardRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nodes as allNodes, edges as allEdges, getChildren } from '../data/architecture'
import { MACRO_POSITIONS, microGridPosition } from '../lib/layout'
import type { Theme } from '../lib/theme'
import MapNode, { type MapNodeData } from './MapNode'

const nodeTypes = { mapNode: MapNode }

const THEME_COLORS: Record<Theme, { dot: string; edge: string; edgeLabel: string; minimapNode: string; minimapMask: string }> = {
  dark: { dot: '#262c47', edge: '#4a5178', edgeLabel: '#9aa0c3', minimapNode: '#4a5178', minimapMask: 'rgba(15, 20, 37, 0.7)' },
  light: { dot: '#e2e8f0', edge: '#94a3b8', edgeLabel: '#545557', minimapNode: '#94a3b8', minimapMask: 'rgba(248, 250, 252, 0.7)' },
}
// Matches the fixed width / approximate height of .map-node in App.css - given as an
// initial size hint so fitView can compute a correct transform on the very first render,
// instead of waiting on an async post-mount measurement pass.
const NODE_WIDTH = 220
const NODE_HEIGHT = 92
const FLOW_ACCENT = '#1cc8ee'

interface GraphViewProps {
  currentParentId: string | null
  selectedNodeId: string | null
  highlightedNodeId: string | null
  theme: Theme
  flowCurrentNodeId: string | null
  flowVisitedNodeIds: Set<string>
  flowVisitedEdgeIds: Set<string>
  onSelectNode: (id: string) => void
  onDrillInto: (id: string) => void
}

// Which side an edge should leave/enter a node from, based on where the other
// node actually sits - so a same-row connection goes left/right instead of
// looping out the bottom and back in the top.
function pickHandles(source: { x: number; y: number }, target: { x: number; y: number }) {
  const dx = target.x - source.x
  const dy = target.y - source.y
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? { sourceHandle: 'right', targetHandle: 'left' } : { sourceHandle: 'left', targetHandle: 'right' }
  }
  return dy > 0 ? { sourceHandle: 'bottom', targetHandle: 'top' } : { sourceHandle: 'top', targetHandle: 'bottom' }
}

function nodeCenter(pos: { x: number; y: number }) {
  return { x: pos.x + NODE_WIDTH / 2, y: pos.y + NODE_HEIGHT / 2 }
}

function buildFlowElements(
  currentParentId: string | null,
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

  if (currentParentId === null) {
    const macro = allNodes.filter((n) => !n.parentId)
    const flowNodes: Node<MapNodeData>[] = macro.map((n) => ({
      id: n.id,
      type: 'mapNode',
      position: MACRO_POSITIONS[n.id] ?? { x: 0, y: 0 },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      selected: n.id === selectedNodeId,
      data: {
        label: n.label,
        category: n.category,
        hasChildren: getChildren(n.id).length > 0,
        needsReview: n.needsReview,
        flowState: flowState(n.id),
      },
    }))
    const colors = THEME_COLORS[theme]
    const flowEdges: Edge[] = allEdges.map((e) => {
      const sourcePos = MACRO_POSITIONS[e.source] ?? { x: 0, y: 0 }
      const targetPos = MACRO_POSITIONS[e.target] ?? { x: 0, y: 0 }
      const isFlowEdge = flowVisitedEdgeIds.has(e.id)
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        ...pickHandles(nodeCenter(sourcePos), nodeCenter(targetPos)),
        type: 'smoothstep',
        label: e.label,
        animated: isFlowEdge,
        style: { stroke: isFlowEdge ? FLOW_ACCENT : colors.edge, strokeWidth: isFlowEdge ? 2.5 : 1 },
        labelStyle: { fill: isFlowEdge ? FLOW_ACCENT : colors.edgeLabel, fontSize: 11, fontWeight: isFlowEdge ? 700 : 400 },
      }
    })
    return { flowNodes, flowEdges }
  }

  const children = getChildren(currentParentId)
  const flowNodes: Node<MapNodeData>[] = children.map((n, i) => ({
    id: n.id,
    type: 'mapNode',
    position: microGridPosition(i),
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    selected: n.id === selectedNodeId,
    data: {
      label: n.label,
      category: n.category,
      hasChildren: getChildren(n.id).length > 0,
      needsReview: n.needsReview,
    },
  }))
  return { flowNodes, flowEdges: [] }
}

const GraphView = forwardRef<HTMLDivElement, GraphViewProps>(function GraphView(
  {
    currentParentId,
    selectedNodeId,
    highlightedNodeId,
    theme,
    flowCurrentNodeId,
    flowVisitedNodeIds,
    flowVisitedEdgeIds,
    onSelectNode,
    onDrillInto,
  },
  ref,
) {
  const { flowNodes, flowEdges } = useMemo(
    () => buildFlowElements(currentParentId, selectedNodeId, theme, flowCurrentNodeId, flowVisitedNodeIds, flowVisitedEdgeIds),
    [currentParentId, selectedNodeId, theme, flowCurrentNodeId, flowVisitedNodeIds, flowVisitedEdgeIds],
  )
  const colors = THEME_COLORS[theme]
  const { setCenter, fitView } = useReactFlow()

  useEffect(() => {
    // includeHiddenNodes makes fitView bounds fall back to each node's declared
    // width/height (NODE_WIDTH/NODE_HEIGHT above) instead of requiring the async
    // ResizeObserver-based `measured` size - so the very first fit, right after
    // switching views, doesn't have to race that measurement pass.
    fitView({ padding: 0.25, duration: 200, includeHiddenNodes: true })
    // Re-fit whenever we switch between macro and a micro view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentParentId])

  useEffect(() => {
    if (!highlightedNodeId) return
    const node = flowNodes.find((n) => n.id === highlightedNodeId)
    if (!node) return
    // The detail panel opening/closing resizes this container via flexbox;
    // React Flow's own resize observer needs a tick to pick that up before
    // setCenter's math is correct, so center against the settled layout
    // (a couple of frames later) rather than the just-committed one - this is
    // what keeps the selected node centered in the space left of the sidebar
    // instead of the pre-resize full width.
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, { zoom: 1.1, duration: 400 })
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
        key={currentParentId ?? '__macro__'}
        colorMode={theme}
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onNodeDoubleClick={(_, node) => {
          if (getChildren(node.id).length > 0) onDrillInto(node.id)
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
