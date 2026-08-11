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
import MapNode, { type MapNodeData } from './MapNode'

const nodeTypes = { mapNode: MapNode }
// Matches the fixed width / approximate height of .map-node in App.css - given as an
// initial size hint so fitView can compute a correct transform on the very first render,
// instead of waiting on an async post-mount measurement pass.
const NODE_WIDTH = 220
const NODE_HEIGHT = 92

interface GraphViewProps {
  currentParentId: string | null
  selectedNodeId: string | null
  highlightedNodeId: string | null
  onSelectNode: (id: string) => void
  onDrillInto: (id: string) => void
}

function buildFlowElements(
  currentParentId: string | null,
  selectedNodeId: string | null,
): { flowNodes: Node<MapNodeData>[]; flowEdges: Edge[] } {
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
      },
    }))
    const flowEdges: Edge[] = allEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: false,
      style: { stroke: '#94a3b8' },
      labelStyle: { fill: '#64748b', fontSize: 11 },
    }))
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
  { currentParentId, selectedNodeId, highlightedNodeId, onSelectNode, onDrillInto },
  ref,
) {
  const { flowNodes, flowEdges } = useMemo(
    () => buildFlowElements(currentParentId, selectedNodeId),
    [currentParentId, selectedNodeId],
  )
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
    if (node) {
      setCenter(node.position.x + 90, node.position.y + 40, { zoom: 1.1, duration: 400 })
    }
  }, [highlightedNodeId, flowNodes, setCenter])

  return (
    <div className="graph-view" ref={ref}>
      <ReactFlow
        key={currentParentId ?? '__macro__'}
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
        <Background gap={24} color="#e2e8f0" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor="#94a3b8" />
      </ReactFlow>
    </div>
  )
})

export default GraphView
