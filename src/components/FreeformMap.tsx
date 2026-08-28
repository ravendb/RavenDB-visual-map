import { useCallback, useMemo, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Node,
  type NodeChange,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nodes as allNodes, edges as allEdges, getChildren, getNode } from '../data/architecture'
import { MACRO_POSITIONS } from '../lib/layout'
import { loadFreeformPositions, saveFreeformPositions, clearFreeformPositions, type FreeformPositions } from '../lib/freeformLayout'
import type { Theme } from '../lib/theme'
import MapNode, { type MapNodeData } from './MapNode'
import NodeDetailPanel from './NodeDetailPanel'

const nodeTypes = { mapNode: MapNode }

const THEME_COLORS: Record<Theme, { dot: string; edge: string; minimapNode: string; minimapMask: string }> = {
  dark: { dot: '#262c47', edge: '#4a5178', minimapNode: '#4a5178', minimapMask: 'rgba(15, 20, 37, 0.7)' },
  light: { dot: '#e2e8f0', edge: '#94a3b8', minimapNode: '#94a3b8', minimapMask: 'rgba(248, 250, 252, 0.7)' },
}

// Same card and expanded-children-grid sizing as GraphView, so a node that
// happens to be expanded here (a permanent one, or one the user clicked)
// takes up exactly the same footprint it would on the main map.
const NODE_WIDTH = 220
const NODE_HEIGHT = 92
const CHILD_COLS = 2
const CHILD_CARD_WIDTH = 250
const CHILD_CARD_HEIGHT = 48
const CHILD_GAP = 10
const EXPANDED_PADDING = 14
const EXPANDED_HEADER_HEIGHT = 96

const MACRO_NODES = allNodes.filter((n) => !n.parentId)
const MACRO_IDS = new Set(MACRO_NODES.map((n) => n.id))
// Only edges between two macro nodes make sense here - there's no
// expanded-in-place view on this page for an edge into a micro node to
// point at.
const MACRO_EDGES = allEdges.filter((e) => MACRO_IDS.has(e.source) && MACRO_IDS.has(e.target))

function expandedSize(childCount: number, childColumns: number): { width: number; height: number } {
  const cols = Math.min(childColumns, Math.max(childCount, 1))
  const rows = Math.max(1, Math.ceil(childCount / childColumns))
  const width = EXPANDED_PADDING * 2 + cols * CHILD_CARD_WIDTH + (cols - 1) * CHILD_GAP
  const height = EXPANDED_HEADER_HEIGHT + EXPANDED_PADDING + rows * CHILD_CARD_HEIGHT + (rows - 1) * CHILD_GAP
  return { width: Math.max(width, NODE_WIDTH), height }
}

// A node is expanded either because it's permanently expanded (see
// MapNode.permanent, e.g. Storages) or because the user clicked it - same
// rule GraphView uses for the main map.
function nodeExpandState(id: string, expandedNodeId: string | null) {
  const node = getNode(id)
  const children = getChildren(id)
  const permanent = node?.permanent === true
  const isExpanded = (id === expandedNodeId || permanent) && children.length > 0
  const childColumns = node?.childColumns ?? CHILD_COLS
  const size = isExpanded ? expandedSize(children.length, childColumns) : { width: NODE_WIDTH, height: NODE_HEIGHT }
  return { isExpanded, size, permanent, children, childColumns }
}

function defaultBasePositions(): FreeformPositions {
  const saved = loadFreeformPositions()
  const positions: FreeformPositions = {}
  MACRO_NODES.forEach((n) => {
    positions[n.id] = saved[n.id] ?? MACRO_POSITIONS[n.id] ?? { x: 0, y: 0 }
  })
  return positions
}

// A simple dominant-axis side pick - good enough once node placement is the
// user's own choice rather than a hand-tuned grid, unlike GraphView's more
// elaborate version tuned for the fixed macro layout.
function pickSides(source: { x: number; y: number }, target: { x: number; y: number }) {
  const dx = target.x - source.x
  const dy = target.y - source.y
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? { sourceSide: 'right', targetSide: 'left' } : { sourceSide: 'left', targetSide: 'right' }
  }
  return dy > 0 ? { sourceSide: 'bottom', targetSide: 'top' } : { sourceSide: 'top', targetSide: 'bottom' }
}

interface FreeformMapProps {
  theme: Theme
  onExit: () => void
}

function FreeformMapInner({ theme, onExit }: FreeformMapProps) {
  const [basePositions, setBasePositions] = useState<FreeformPositions>(defaultBasePositions)
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const colors = THEME_COLORS[theme]

  const nodes = useMemo<Node<MapNodeData>[]>(
    () =>
      MACRO_NODES.map((n) => {
        const { isExpanded, size, permanent, children, childColumns } = nodeExpandState(n.id, expandedNodeId)
        const base = basePositions[n.id] ?? MACRO_POSITIONS[n.id] ?? { x: 0, y: 0 }
        // Grows outward from the anchor's own center, same as GraphView's
        // expandedPosition - so toggling expand doesn't shift where the tile
        // "is" from the user's point of view, it just grows around that spot.
        const position = {
          x: base.x - (size.width - NODE_WIDTH) / 2,
          y: base.y - (size.height - NODE_HEIGHT) / 2,
        }
        return {
          id: n.id,
          type: 'mapNode',
          position,
          width: size.width,
          height: size.height,
          zIndex: isExpanded ? 10 : 0,
          selected: n.id === selectedNodeId,
          data: {
            label: n.label,
            category: n.category,
            hasChildren: children.length > 0,
            expanded: isExpanded,
            permanent,
            childColumns,
            dimmed: expandedNodeId ? n.id !== expandedNodeId && !permanent : false,
            selectedChildId: isExpanded ? selectedNodeId ?? undefined : undefined,
            children: isExpanded ? children.map((c) => ({ id: c.id, label: c.label, category: c.category })) : undefined,
          },
        }
      }),
    [basePositions, expandedNodeId, selectedNodeId],
  )

  const edges = useMemo<Edge[]>(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    function center(n: Node) {
      return { x: n.position.x + (n.width ?? NODE_WIDTH) / 2, y: n.position.y + (n.height ?? NODE_HEIGHT) / 2 }
    }
    return MACRO_EDGES.map((e) => {
      const sourceNode = byId.get(e.source)
      const targetNode = byId.get(e.target)
      const { sourceSide, targetSide } =
        sourceNode && targetNode ? pickSides(center(sourceNode), center(targetNode)) : { sourceSide: 'bottom', targetSide: 'top' }
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: sourceSide,
        targetHandle: targetSide,
        type: 'smoothstep',
        label: e.label,
        style: { stroke: colors.edge, strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: colors.edge, width: 14, height: 14 },
      }
    })
  }, [nodes, colors.edge])

  // React Flow reports drag moves as the *rendered* position - which, for a
  // currently-expanded node, already includes the grow-outward-from-center
  // offset - so that offset has to come back out before it's saved as the
  // anchor, or the tile would jump by it the next time it collapses.
  const onNodesChange = useCallback(
    (changes: NodeChange<Node<MapNodeData>>[]) => {
      setBasePositions((prev) => {
        let next = prev
        for (const change of changes) {
          if (change.type !== 'position' || !change.position) continue
          const { size } = nodeExpandState(change.id, expandedNodeId)
          next = {
            ...next,
            [change.id]: {
              x: change.position.x + (size.width - NODE_WIDTH) / 2,
              y: change.position.y + (size.height - NODE_HEIGHT) / 2,
            },
          }
        }
        return next
      })
    },
    [expandedNodeId],
  )

  const handleNodeDragStop = useCallback(() => {
    setBasePositions((current) => {
      saveFreeformPositions(current)
      return current
    })
  }, [])

  function handleReset() {
    clearFreeformPositions()
    setBasePositions(defaultBasePositions())
    setExpandedNodeId(null)
    setSelectedNodeId(null)
  }

  const selectedNode = selectedNodeId ? getNode(selectedNodeId) : undefined

  return (
    <div className="app">
      <header className="toolbar">
        <div className="toolbar__brand">RavenDB Architecture Map</div>
        <span className="freeform-badge">Free layout - drag tiles anywhere</span>
        <div className="toolbar__export">
          <button onClick={handleReset}>Reset layout</button>
          <button onClick={onExit}>← Back to map</button>
        </div>
      </header>
      <div className="app__body">
        <ReactFlow
          colorMode={theme}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={(event, node) => {
            if ((event.target as HTMLElement).closest('[data-node-close]')) {
              if (getChildren(node.id).length > 0) setExpandedNodeId((prev) => (prev === node.id ? null : prev))
              else setSelectedNodeId(null)
              return
            }
            const childId = (event.target as HTMLElement).closest('[data-child-id]')?.getAttribute('data-child-id')
            if (childId) {
              setSelectedNodeId(childId)
              return
            }
            setSelectedNodeId(node.id)
            if (getChildren(node.id).length > 0 && !getNode(node.id)?.permanent) {
              setExpandedNodeId((prev) => (prev === node.id ? null : node.id))
            }
          }}
          onPaneClick={() => setExpandedNodeId(null)}
          proOptions={{ hideAttribution: true }}
          minZoom={0.2}
          maxZoom={2}
          nodesConnectable={false}
          elementsSelectable={false}
        >
          <Background gap={24} color={colors.dot} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeColor={colors.minimapNode} maskColor={colors.minimapMask} />
        </ReactFlow>
        {selectedNode && <NodeDetailPanel nodeId={selectedNode.id} theme={theme} onClose={() => setSelectedNodeId(null)} />}
      </div>
    </div>
  )
}

export default function FreeformMap(props: FreeformMapProps) {
  return (
    <ReactFlowProvider>
      <FreeformMapInner {...props} />
    </ReactFlowProvider>
  )
}
