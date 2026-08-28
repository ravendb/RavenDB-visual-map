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
  onSelectNode: (id: string) => void
  onToggleExpand: (id: string) => void
  onDeselect: () => void
}

// Which side an edge should leave/enter a node from, based on where the other
// node actually sits - so a same-row connection goes left/right instead of
// looping out the bottom and back in the top.
// How close to exactly diagonal (dx === dy) an edge has to be before it's
// treated as a tie between the two axes, rather than one axis dominating.
// Checked against every edge in the current layout: only client->http and
// studio->http actually sit at a dead-even 1.0 - the next closest is 0.91 -
// so this threshold is deliberately tight, to touch only the pairs that
// genuinely have no dominant axis rather than every edge that merely isn't
// perfectly aligned.
const DIAGONAL_TIE_THRESHOLD = 0.95
// Below this offset, an axis counts as negligible - the nodes are
// essentially aligned on it rather than genuinely offset.
const LEVEL_EPSILON = 10

interface Box {
  x: number
  y: number
  width: number
  height: number
}

function boxCenter(box: Box) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

// Positive gap between two boxes' extents along one axis; 0 (or negative,
// clamped) when they actually overlap on it - e.g. a permanently-expanded
// node's row/column span reaching past a smaller node positioned "beside"
// it in the hand-placed grid, the way Sharding's y-range sits well inside
// Storages' now that Storages is tall enough to span several node-rows.
function axisGap(sourceMin: number, sourceMax: number, targetMin: number, targetMax: number): number {
  if (targetMin > sourceMax) return targetMin - sourceMax
  if (sourceMin > targetMax) return sourceMin - targetMax
  return 0
}

function rangeOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin < bMax && bMin < aMax
}

// Would hugging `hugAxis` (the coordinate held within source's own extent
// on that axis - see the callers below) necessarily cut through one of
// `obstacles` on the way to target? The exact lane offset isn't decided
// yet at this point, so this checks conservatively against source's *whole*
// extent on hugAxis - e.g. two nodes placed level with each other, the way
// Queries sits in HTTP's own row: no matter which offset within HTTP's
// height a lane ends up at, it's still inside Queries' row.
function hugCrossesObstacle(hugAxis: 'x' | 'y', sourceBox: Box, targetBox: Box, obstacles: Box[]): boolean {
  const hugMin = hugAxis === 'y' ? sourceBox.y : sourceBox.x
  const hugMax = hugAxis === 'y' ? sourceBox.y + sourceBox.height : sourceBox.x + sourceBox.width
  const travelMin = hugAxis === 'y' ? Math.min(sourceBox.x, targetBox.x) : Math.min(sourceBox.y, targetBox.y)
  const travelMax =
    hugAxis === 'y'
      ? Math.max(sourceBox.x + sourceBox.width, targetBox.x + targetBox.width)
      : Math.max(sourceBox.y + sourceBox.height, targetBox.y + targetBox.height)
  return obstacles.some((box) => {
    const hugOverlap = hugAxis === 'y' ? rangeOverlap(hugMin, hugMax, box.y, box.y + box.height) : rangeOverlap(hugMin, hugMax, box.x, box.x + box.width)
    const travelOverlap =
      hugAxis === 'y' ? rangeOverlap(travelMin, travelMax, box.x, box.x + box.width) : rangeOverlap(travelMin, travelMax, box.y, box.y + box.height)
    return hugOverlap && travelOverlap
  })
}

function pickSides(sourceBox: Box, targetBox: Box, obstacles: Box[]): { sourceSide: HandleSide; targetSide: HandleSide } {
  const source = boxCenter(sourceBox)
  const target = boxCenter(targetBox)
  const dx = target.x - source.x
  const dy = target.y - source.y
  // A box's actual extent (not just its center) decides whether entering
  // from top/bottom or left/right is even geometrically sane: if the boxes
  // already overlap along an axis, a handle on that axis has no "outside" to
  // approach from without first overshooting past the other box and
  // doubling back - so that axis is off the table regardless of which one
  // the centers alone would call dominant.
  const xOverlaps = axisGap(sourceBox.x, sourceBox.x + sourceBox.width, targetBox.x, targetBox.x + targetBox.width) === 0
  const yOverlaps = axisGap(sourceBox.y, sourceBox.y + sourceBox.height, targetBox.y, targetBox.y + targetBox.height) === 0
  if (yOverlaps && !xOverlaps) {
    return { sourceSide: dx > 0 ? 'right' : 'left', targetSide: dx > 0 ? 'left' : 'right' }
  }
  if (xOverlaps && !yOverlaps) {
    return { sourceSide: dy > 0 ? 'bottom' : 'top', targetSide: dy > 0 ? 'top' : 'bottom' }
  }
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)
  const larger = Math.max(absDx, absDy)
  const smaller = Math.min(absDx, absDy)
  // A genuine tie: a same-orientation pair of handles (both top/bottom or
  // both left/right) bends at the midpoint between the two nodes by
  // default, which is exactly where an unrelated node placed between them
  // tends to sit. Perpendicular handles instead force the bend to the
  // target's own row/column, so the path hugs the source's column down (or
  // row across) - clear of anything else - and only turns once it's
  // already alongside the target. Anything short of a real tie keeps the
  // dominant-axis pick below instead - it already routes those edges clear
  // of whatever sits in the source's own column/row.
  if (larger > 0 && smaller / larger >= DIAGONAL_TIE_THRESHOLD && !hugCrossesObstacle('x', sourceBox, targetBox, obstacles)) {
    return {
      sourceSide: dy > 0 ? 'bottom' : 'top',
      targetSide: dx > 0 ? 'left' : 'right',
    }
  }
  // The minor axis is negligible - the nodes are essentially aligned on it -
  // so a same-orientation pair (assignLanes' `level` check picks this up and
  // runs it dead straight) needs no jog at all.
  if (smaller < LEVEL_EPSILON) {
    return absDx > absDy
      ? dx > 0
        ? { sourceSide: 'right', targetSide: 'left' }
        : { sourceSide: 'left', targetSide: 'right' }
      : dy > 0
        ? { sourceSide: 'bottom', targetSide: 'top' }
        : { sourceSide: 'top', targetSide: 'bottom' }
  }
  // One axis clearly dominates, but the other is still real (not a tie,
  // not negligible): a same-orientation pair here would still default to a
  // midpoint bend - two turns - so hug the *dominant* axis from the source
  // instead, keeping the long straight run in the source's own row/column,
  // and turn into the target via the minor axis once alongside it. One turn
  // instead of two, and - unlike blindly always hugging the vertical axis -
  // this hugs whichever axis actually has the room to spare. But only when
  // that row/column is actually clear - hugging HTTP's own row to reach
  // Cluster, for instance, would cut straight through Queries, which sits
  // in that exact row. When it's blocked, a same-orientation pair's
  // midpoint bend - governed by both axes independently rather than
  // committing to one - routes around it instead, so fall back to that.
  if (absDx > absDy && !hugCrossesObstacle('y', sourceBox, targetBox, obstacles)) {
    return { sourceSide: dx > 0 ? 'right' : 'left', targetSide: dy > 0 ? 'top' : 'bottom' }
  }
  if (absDy >= absDx && !hugCrossesObstacle('x', sourceBox, targetBox, obstacles)) {
    return { sourceSide: dy > 0 ? 'bottom' : 'top', targetSide: dx > 0 ? 'left' : 'right' }
  }
  return absDx > absDy
    ? dx > 0
      ? { sourceSide: 'right', targetSide: 'left' }
      : { sourceSide: 'left', targetSide: 'right' }
    : dy > 0
      ? { sourceSide: 'bottom', targetSide: 'top' }
      : { sourceSide: 'top', targetSide: 'bottom' }
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
  // Every macro node's box, so a route can be checked against whatever else
  // is sitting nearby - not just the two nodes it actually connects.
  const macroBoxes = new Map<string, Box>(allNodes.filter((n) => !n.parentId).map((n) => [n.id, nodeBox(n.id)]))

  const sides = edges.map((e) => {
    const sourceBox = nodeBox(e.source)
    const targetBox = nodeBox(e.target)
    const sourcePos = boxCenter(sourceBox)
    const targetPos = boxCenter(targetBox)
    const obstacles = [...macroBoxes.entries()].filter(([id]) => id !== e.source && id !== e.target).map(([, box]) => box)
    const { sourceSide, targetSide } = pickSides(sourceBox, targetBox, obstacles)
    // A pair of same-orientation handles (both left/right, or both
    // top/bottom) is only actually capable of running straight when the two
    // nodes are level on the other axis - which pickSides' choice of sides
    // doesn't by itself guarantee (an L-shaped pair is a different
    // orientation combination entirely, never "straight" regardless).
    const bothHorizontal = (sourceSide === 'left' || sourceSide === 'right') && (targetSide === 'left' || targetSide === 'right')
    const bothVertical = (sourceSide === 'top' || sourceSide === 'bottom') && (targetSide === 'top' || targetSide === 'bottom')
    const level = bothHorizontal
      ? Math.abs(targetPos.y - sourcePos.y) < LEVEL_EPSILON
      : bothVertical
        ? Math.abs(targetPos.x - sourcePos.x) < LEVEL_EPSILON
        : false
    return { edge: e, sourceSide, targetSide, level }
  })

  // Each lane entry remembers where the *other* end of its edge actually
  // sits, so the group can be ordered by that instead of by edge id.
  interface LaneEntry {
    edgeId: string
    otherPos: { x: number; y: number }
  }
  const laneGroups = new Map<string, LaneEntry[]>()
  // Sides a level edge has already claimed the center of - the proportional
  // split below has to steer every other edge on that same side around that
  // point instead of also landing on it, which an unclaimed side (or one
  // with only a single occupant, which centers itself by default too) would
  // otherwise do.
  const centerClaimed = new Set<string>()
  function addToLane(nodeId: string, side: HandleSide, edgeId: string, otherPos: { x: number; y: number }) {
    const key = `${nodeId}:${side}`
    const list = laneGroups.get(key) ?? []
    list.push({ edgeId, otherPos })
    laneGroups.set(key, list)
  }
  sides.forEach(({ edge, sourceSide, targetSide, level }) => {
    // A level pair goes straight through the center of both handles instead
    // of sharing the proportional lane split below - so it isn't thrown off
    // by however many other, unrelated edges happen to share that side, and
    // doesn't itself skew their split by occupying one of the slots.
    if (level) {
      centerClaimed.add(`${edge.source}:${sourceSide}`)
      centerClaimed.add(`${edge.target}:${targetSide}`)
      return
    }
    const sourcePos = boxCenter(nodeBox(edge.source))
    const targetPos = boxCenter(nodeBox(edge.target))
    addToLane(edge.source, sourceSide, edge.id, targetPos)
    addToLane(edge.target, targetSide, edge.id, sourcePos)
  })
  // A top/bottom lane's offset reads as a left-to-right position, a
  // left/right lane's as top-to-bottom (see handleStyle) - so ordering each
  // group by the other node's position along that same axis makes the
  // handle point toward roughly where its target actually is, instead of an
  // arbitrary (alphabetical-by-id) slot that forces an otherwise-avoidable
  // jog into the smoothstep path. Falls back to the id for a stable order
  // when two edges' other ends tie exactly on that axis.
  laneGroups.forEach((list, key) => {
    const side = key.slice(key.indexOf(':') + 1) as HandleSide
    const axis = side === 'top' || side === 'bottom' ? 'x' : 'y'
    list.sort((a, b) => a.otherPos[axis] - b.otherPos[axis] || a.edgeId.localeCompare(b.edgeId))
  })

  // How much of the middle to leave clear for a level edge's own center
  // handle - e.g. 15 reserves 35-65% so nothing else's line runs through or
  // right alongside it.
  const CENTER_GAP = 15

  function laneOffset(nodeId: string, side: HandleSide, edgeId: string, level: boolean): number {
    if (level) return 50
    const list = laneGroups.get(`${nodeId}:${side}`) ?? [{ edgeId, otherPos: { x: 0, y: 0 } }]
    const index = list.findIndex((entry) => entry.edgeId === edgeId)
    const fraction = (index + 1) / (list.length + 1)
    if (!centerClaimed.has(`${nodeId}:${side}`)) return fraction * 100
    // Squeeze the usual evenly-spaced spread into the two halves outside the
    // reserved center band, instead of letting it land inside.
    const halfSpan = (50 - CENTER_GAP) / 50
    return fraction < 0.5 ? fraction * 100 * halfSpan : 50 + CENTER_GAP + (fraction * 100 - 50) * halfSpan
  }

  const edgeAnchors = new Map<string, { sourceHandle: string; targetHandle: string }>()
  const nodeHandles = new Map<string, NodeHandleSpec[]>()
  function ensureHandle(nodeId: string, side: HandleSide, offset: number) {
    const id = handleId(side, offset)
    const list = nodeHandles.get(nodeId) ?? []
    if (!list.some((h) => h.id === id)) list.push({ id, side, offset })
    nodeHandles.set(nodeId, list)
  }

  sides.forEach(({ edge, sourceSide, targetSide, level }) => {
    const sourceOffset = laneOffset(edge.source, sourceSide, edge.id, level)
    const targetOffset = laneOffset(edge.target, targetSide, edge.id, level)
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
  flowNodeIds: Set<string>,
): { flowNodes: Node<MapNodeData>[]; flowEdges: Edge[] } {
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
  const { edgeAnchors, nodeHandles } = assignLanes(allEdges)

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
        // the flow doesn't touch - into the background, like a spotlight.
        // Permanent nodes are exempt: they stay in focus regardless of what
        // else is expanded, the same way they're never the thing being dimmed.
        dimmed: expandedNodeId ? n.id !== expandedNodeId && !permanent : isFlowActive && !flowNodeIds.has(n.id),
        selectedChildId: isExpanded ? selectedNodeId ?? undefined : undefined,
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
    // Mirrors the node dimming above: with a node expanded, only edges
    // touching it stay in focus; with a flow playing, only edges that connect
    // two nodes the flow actually visits do.
    const inFocus = expandedNodeId
      ? e.source === expandedNodeId || e.target === expandedNodeId
      : !isFlowActive || (flowNodeIds.has(e.source) && flowNodeIds.has(e.target))
    return {
      id: e.id,
      source: e.source,
      target: e.target,
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
    onSelectNode,
    onToggleExpand,
    onDeselect,
  },
  ref,
) {
  const { flowNodes, flowEdges } = useMemo(
    () => buildFlowElements(expandedNodeId, selectedNodeId, theme, flowCurrentNodeId, flowVisitedNodeIds, flowVisitedEdgeIds, flowNodeIds),
    [expandedNodeId, selectedNodeId, theme, flowCurrentNodeId, flowVisitedNodeIds, flowVisitedEdgeIds, flowNodeIds],
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
        onPaneClick={() => {
          if (expandedNodeId) onToggleExpand(expandedNodeId)
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
