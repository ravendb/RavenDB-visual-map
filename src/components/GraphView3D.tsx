import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { nodes as allNodes, edges as allEdges, getChildren, type NodeCategory } from '../data/architecture'
import { MACRO_POSITIONS, microGridPosition } from '../lib/layout'
import type { Theme } from '../lib/theme'
import NodeCard from './NodeCard'

interface GraphView3DProps {
  currentParentId: string | null
  selectedNodeId: string | null
  highlightedNodeId: string | null
  theme: Theme
  flowCurrentNodeId: string | null
  flowVisitedNodeIds: Set<string>
  flowVisitedEdgeIds: Set<string>
  flowNodeIds: Set<string>
  onSelectNode: (id: string) => void
  onDrillInto: (id: string) => void
}

export interface GraphView3DHandle {
  exportPng: () => Promise<string | null>
}

const NODE_WIDTH = 220
const NODE_HEIGHT = 92
const FLOW_ACCENT = '#1cc8ee'
// The same X/Y positions the 2D view uses, so the flow-diagram layout stays
// legible - depth (Z) is derived from Y so the layered architecture (client at
// the top down to infra at the bottom) reads as receding into the scene.
const Z_SCALE = 0.3
const DEFAULT_ROTATE_X = -12
const DEFAULT_ROTATE_Y = 12
const ROTATE_X_LIMIT = 75
const ROTATE_Y_LIMIT = 75

interface LayoutNode {
  id: string
  label: string
  category: NodeCategory
  hasChildren: boolean
  x: number
  y: number
  z: number
}

const GraphView3D = forwardRef<GraphView3DHandle, GraphView3DProps>(function GraphView3D(
  {
    currentParentId,
    selectedNodeId,
    highlightedNodeId,
    theme,
    flowCurrentNodeId,
    flowVisitedNodeIds,
    flowVisitedEdgeIds,
    flowNodeIds,
    onSelectNode,
    onDrillInto,
  },
  ref,
) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 800, height: 600 })
  const [rotateX, setRotateX] = useState(DEFAULT_ROTATE_X)
  const [rotateY, setRotateY] = useState(DEFAULT_ROTATE_Y)
  const [zoom, setZoom] = useState(1)
  const [isAnimating, setIsAnimating] = useState(false)
  const dragRef = useRef<{ x: number; y: number; rotateX: number; rotateY: number; dragged: boolean } | null>(null)

  // A brief, explicitly-triggered transition for programmatic re-centers
  // (selecting a node, resetting the view) - drag and scroll-zoom stay
  // instant/1:1 with the input, only this flags them as animated.
  function animateRecenter() {
    setIsAnimating(true)
    window.setTimeout(() => setIsAnimating(false), 400)
  }

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const layoutNodes = useMemo<LayoutNode[]>(() => {
    if (currentParentId === null) {
      return allNodes
        .filter((n) => !n.parentId)
        .map((n) => {
          const pos = MACRO_POSITIONS[n.id] ?? { x: 0, y: 0 }
          return {
            id: n.id,
            label: n.label,
            category: n.category,
            hasChildren: getChildren(n.id).length > 0,
            x: pos.x,
            y: pos.y,
            z: -pos.y * Z_SCALE,
          }
        })
    }
    return getChildren(currentParentId).map((n, i) => {
      const pos = microGridPosition(i)
      return {
        id: n.id,
        label: n.label,
        category: n.category,
        hasChildren: getChildren(n.id).length > 0,
        x: pos.x,
        y: pos.y,
        z: -pos.y * Z_SCALE,
      }
    })
  }, [currentParentId])

  const bbox = useMemo(() => {
    if (layoutNodes.length === 0) return { cx: 0, cy: 0, cz: 0, width: 800, height: 600 }
    const minX = Math.min(...layoutNodes.map((n) => n.x))
    const maxX = Math.max(...layoutNodes.map((n) => n.x + NODE_WIDTH))
    const minY = Math.min(...layoutNodes.map((n) => n.y))
    const maxY = Math.max(...layoutNodes.map((n) => n.y + NODE_HEIGHT))
    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      cz: (-minY * Z_SCALE + -maxY * Z_SCALE) / 2,
      width: Math.max(maxX - minX, 1),
      height: Math.max(maxY - minY, 1),
    }
  }, [layoutNodes])

  const fitZoom = useMemo(() => {
    // Padding factor and a generous margin so the 3D tilt doesn't clip nodes
    // at the edges of the bounding box.
    const z = Math.min(size.width / (bbox.width * 1.6), size.height / (bbox.height * 1.6))
    return Math.max(0.35, Math.min(z || 1, 1.4))
  }, [size, bbox])

  // Center on the selected node (so it stays centered in the space left of
  // the detail panel, whatever that panel's width is) - falling back to the
  // active flow's current step so playback re-centers on its own, then to the
  // whole layout's center when neither applies.
  const focalPoint = useMemo(() => {
    const focusId = selectedNodeId ?? flowCurrentNodeId
    const focused = focusId ? layoutNodes.find((n) => n.id === focusId) : undefined
    if (!focused) return { x: bbox.cx, y: bbox.cy, z: bbox.cz }
    return { x: focused.x + NODE_WIDTH / 2, y: focused.y + NODE_HEIGHT / 2, z: focused.z }
  }, [selectedNodeId, flowCurrentNodeId, layoutNodes, bbox])

  const hasInteractedRef = useRef(false)

  useEffect(() => {
    // Re-frame whenever we switch between macro and a micro view.
    hasInteractedRef.current = false
    setRotateX(DEFAULT_ROTATE_X)
    setRotateY(DEFAULT_ROTATE_Y)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentParentId])

  useEffect(() => {
    // Re-center (animated) whenever the focal point moves - selecting a node,
    // or the detail panel opening/closing and shifting where "centered" is.
    animateRecenter()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focalPoint.x, focalPoint.y, focalPoint.z, size.width, size.height])

  useEffect(() => {
    // Keep following fitZoom as the container is measured (the very first
    // pass uses a placeholder size) as long as the user hasn't zoomed/dragged
    // since switching views.
    if (!hasInteractedRef.current) setZoom(fitZoom)
  }, [fitZoom, currentParentId])

  function resetView() {
    hasInteractedRef.current = false
    animateRecenter()
    setRotateX(DEFAULT_ROTATE_X)
    setRotateY(DEFAULT_ROTATE_Y)
    setZoom(fitZoom)
  }

  useImperativeHandle(ref, () => ({
    exportPng: async () => {
      // .scene3d itself is a zero-size transform anchor (every child is
      // absolutely positioned) - capture the sized viewport container instead.
      const el = viewportRef.current
      if (!el) return null
      return toPng(el, { pixelRatio: 2 })
    },
  }))

  function handlePointerDown(e: React.PointerEvent) {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, rotateX, rotateY, dragged: false }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      drag.dragged = true
      hasInteractedRef.current = true
    }
    setRotateY(Math.max(-ROTATE_Y_LIMIT, Math.min(ROTATE_Y_LIMIT, drag.rotateY + dx * 0.3)))
    setRotateX(Math.max(-ROTATE_X_LIMIT, Math.min(ROTATE_X_LIMIT, drag.rotateX - dy * 0.3)))
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    hasInteractedRef.current = true
    setZoom((z) => Math.max(0.3, Math.min(2.5, z - e.deltaY * 0.001)))
  }

  const sceneTransform =
    `translate3d(${size.width / 2}px, ${size.height / 2}px, 0px) ` +
    `scale(${zoom}) rotateX(${rotateX}deg) rotateY(${rotateY}deg) ` +
    `translate3d(${-focalPoint.x}px, ${-focalPoint.y}px, ${-focalPoint.z}px)`

  const nodeById = new Map(layoutNodes.map((n) => [n.id, n]))
  const themeVars = theme === 'dark'
    ? { edge: '#4a5178', edgeLabelBg: 'rgba(15, 20, 37, 0.85)', edgeLabelText: '#9aa0c3' }
    : { edge: '#94a3b8', edgeLabelBg: 'rgba(255, 255, 255, 0.9)', edgeLabelText: '#545557' }

  const edgeSegments =
    currentParentId === null
      ? allEdges
          .map((e) => {
            const source = nodeById.get(e.source)
            const target = nodeById.get(e.target)
            if (!source || !target) return null
            const sx = source.x + NODE_WIDTH / 2
            const sy = source.y + NODE_HEIGHT / 2
            const sz = source.z
            const tx = target.x + NODE_WIDTH / 2
            const ty = target.y + NODE_HEIGHT / 2
            const tz = target.z
            const dx = tx - sx
            const dy = ty - sy
            const dz = tz - sz
            const length = Math.sqrt(dx * dx + dy * dy + dz * dz)
            const horiz = Math.sqrt(dx * dx + dz * dz)
            const yaw = Math.atan2(dz, dx) * (180 / Math.PI)
            const pitch = Math.atan2(dy, horiz) * (180 / Math.PI)
            return {
              id: e.id,
              source: e.source,
              target: e.target,
              label: e.label,
              sx,
              sy,
              sz,
              length,
              yaw,
              pitch,
              mid: { x: (sx + tx) / 2, y: (sy + ty) / 2, z: (sz + tz) / 2 },
            }
          })
          .filter((e): e is NonNullable<typeof e> => e !== null)
      : []

  return (
    <div
      className="graph-view graph-view--3d"
      ref={viewportRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
    >
      <button className="graph-view__reset" onClick={resetView} title="Reset the 3D view">
        Reset view
      </button>
      <div
        className="scene3d"
        ref={sceneRef}
        style={{ transform: sceneTransform, transition: isAnimating ? 'transform 0.35s ease' : 'none' }}
      >
        {edgeSegments.map((edge) => {
          const isFlowEdge = flowVisitedEdgeIds.has(edge.id)
          // Mirrors the 2D view: while a flow plays, fade out edges that
          // don't connect two nodes the flow actually visits.
          const inFocus = !flowCurrentNodeId || (flowNodeIds.has(edge.source) && flowNodeIds.has(edge.target))
          return (
            <div key={edge.id} style={{ opacity: inFocus ? 1 : 0.15 }}>
              <div
                className={isFlowEdge ? 'edge3d edge3d--flow' : 'edge3d'}
                style={{
                  width: edge.length,
                  background: isFlowEdge ? FLOW_ACCENT : themeVars.edge,
                  transform: `translate3d(${edge.sx}px, ${edge.sy}px, ${edge.sz}px) rotateY(${-edge.yaw}deg) rotateZ(${edge.pitch}deg)`,
                }}
              />
              {edge.label && (
                <div
                  className="edge3d__label"
                  style={{
                    background: isFlowEdge ? FLOW_ACCENT : themeVars.edgeLabelBg,
                    color: isFlowEdge ? '#0f1425' : themeVars.edgeLabelText,
                    fontWeight: isFlowEdge ? 700 : 400,
                    transform: `translate3d(${edge.mid.x}px, ${edge.mid.y}px, ${edge.mid.z}px) rotateY(${-rotateY}deg) rotateX(${-rotateX}deg) translate(-50%, -50%)`,
                  }}
                >
                  {edge.label}
                </div>
              )}
            </div>
          )
        })}
        {layoutNodes.map((node) => {
          const isDragEndClick = () => !dragRef.current?.dragged
          const flowState = node.id === flowCurrentNodeId ? 'current' : flowVisitedNodeIds.has(node.id) ? 'visited' : undefined
          // Mirrors the 2D view: while a flow plays, everything it doesn't touch fades back.
          const dimmed = Boolean(flowCurrentNodeId) && !flowNodeIds.has(node.id)
          return (
            <NodeCard
              key={node.id}
              className="map-node--3d"
              style={{
                transform: `translate3d(${node.x}px, ${node.y}px, ${node.z}px)`,
                opacity: dimmed ? 0.35 : 1,
              }}
              label={node.label}
              category={node.category}
              hasChildren={node.hasChildren}
              selected={node.id === selectedNodeId || node.id === highlightedNodeId}
              flowState={flowState}
              onClick={() => {
                if (isDragEndClick()) onSelectNode(node.id)
              }}
              onDoubleClick={() => {
                if (node.hasChildren && isDragEndClick()) onDrillInto(node.id)
              }}
            />
          )
        })}
      </div>
    </div>
  )
})

export default GraphView3D
