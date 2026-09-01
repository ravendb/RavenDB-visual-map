// Shared orthogonal edge-routing logic used by both the hand-placed macro map
// (GraphView) and the drag-anywhere Free layout (FreeformMap). Both views
// want the same rule: an edge should attach at whichever point on whichever
// side of a box actually faces the other box, spread across a shared side
// instead of stacking on one handle, and bend as few times as it can without
// cutting through a third node. The two views differ only in *where a node's
// box currently is* (a fixed hand-placed layout vs. wherever the user last
// dragged it) - so that part is injected as `boxOf` rather than baked in here.
import type { HandleSide, NodeHandleSpec } from '../components/MapNode'

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface RoutableEdge {
  id: string
  source: string
  target: string
}

// How close to exactly diagonal (dx === dy) an edge has to be before it's
// treated as a tie between the two axes, rather than one axis dominating.
const DIAGONAL_TIE_THRESHOLD = 0.95
// Below this offset, an axis counts as negligible - the nodes are
// essentially aligned on it rather than genuinely offset.
const LEVEL_EPSILON = 10

export function boxCenter(box: Box) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

// Positive gap between two boxes' extents along one axis; 0 (or negative,
// clamped) when they actually overlap on it.
function axisGap(sourceMin: number, sourceMax: number, targetMin: number, targetMax: number): number {
  if (targetMin > sourceMax) return targetMin - sourceMax
  if (sourceMin > targetMax) return sourceMin - targetMax
  return 0
}

export function rangeOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin < bMax && bMin < aMax
}

// Would hugging `hugAxis` (the coordinate held within source's own extent on
// that axis) necessarily cut through one of `obstacles` on the way to target?
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

// Which side an edge should leave/enter a node from, based on where the other
// node actually sits - so a same-row connection goes left/right instead of
// looping out the bottom and back in the top, and a same-column one goes
// straight up/down instead of jogging sideways first.
export function pickSides(sourceBox: Box, targetBox: Box, obstacles: Box[]): { sourceSide: HandleSide; targetSide: HandleSide } {
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
  // that row/column is actually clear - hugging past a node that sits in
  // that exact row/column instead routes around it via the fallback below.
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

function handleId(side: HandleSide, offset: number) {
  return `${side}-${offset.toFixed(2)}`
}

// Several edges often leave/enter the same side of a hub node (e.g. everything
// hanging off Document Database Core). A single centered handle per side made
// them all leave from the exact same pixel and overlap for their whole first
// stretch. This spreads every side's edges evenly across it instead - and
// hands back both the per-edge handle ids and the handle specs each node
// needs to render.
//
// `boxOf` supplies each node's current box - a fixed hand-placed position for
// GraphView's macro map, or wherever the user last dragged it for FreeformMap
// - so the same lane/obstacle logic works for both without caring which.
export function assignLanes<T extends RoutableEdge>(
  edges: T[],
  nodeIds: string[],
  boxOf: (id: string) => Box,
): { edgeAnchors: Map<string, { sourceHandle: string; targetHandle: string }>; nodeHandles: Map<string, NodeHandleSpec[]> } {
  // Every node's box, so a route can be checked against whatever else is
  // sitting nearby - not just the two nodes it actually connects.
  const macroBoxes = new Map<string, Box>(nodeIds.map((id) => [id, boxOf(id)]))

  const sides = edges.map((e) => {
    const sourceBox = macroBoxes.get(e.source) ?? boxOf(e.source)
    const targetBox = macroBoxes.get(e.target) ?? boxOf(e.target)
    const obstacles = [...macroBoxes.entries()].filter(([id]) => id !== e.source && id !== e.target).map(([, box]) => box)
    const { sourceSide, targetSide } = pickSides(sourceBox, targetBox, obstacles)
    // A pair of same-orientation handles (both left/right, or both
    // top/bottom) can only ever run dead straight - zero bends - when the two
    // boxes actually share some range on the *other* axis: any coordinate in
    // that shared band is a valid attach point on both, so picking one inside
    // it needs no jog at all. This used to require the two boxes' centers to
    // nearly coincide, which missed pairs that overlap generously but aren't
    // centered on each other (e.g. a short, permanently-expanded card level
    // with a much taller one) - those still got a routable side pair from
    // pickSides, but each end defaulted to its own box's center regardless,
    // producing an avoidable double bend between the two different centers.
    const bothHorizontal = (sourceSide === 'left' || sourceSide === 'right') && (targetSide === 'left' || targetSide === 'right')
    const bothVertical = (sourceSide === 'top' || sourceSide === 'bottom') && (targetSide === 'top' || targetSide === 'bottom')
    let level = false
    let sourceLevelOffset = 50
    let targetLevelOffset = 50
    if (bothHorizontal && rangeOverlap(sourceBox.y, sourceBox.y + sourceBox.height, targetBox.y, targetBox.y + targetBox.height)) {
      const lo = Math.max(sourceBox.y, targetBox.y)
      const hi = Math.min(sourceBox.y + sourceBox.height, targetBox.y + targetBox.height)
      const shared = (lo + hi) / 2
      sourceLevelOffset = ((shared - sourceBox.y) / sourceBox.height) * 100
      targetLevelOffset = ((shared - targetBox.y) / targetBox.height) * 100
      level = true
    } else if (bothVertical && rangeOverlap(sourceBox.x, sourceBox.x + sourceBox.width, targetBox.x, targetBox.x + targetBox.width)) {
      const lo = Math.max(sourceBox.x, targetBox.x)
      const hi = Math.min(sourceBox.x + sourceBox.width, targetBox.x + targetBox.width)
      const shared = (lo + hi) / 2
      sourceLevelOffset = ((shared - sourceBox.x) / sourceBox.width) * 100
      targetLevelOffset = ((shared - targetBox.x) / targetBox.width) * 100
      level = true
    }
    return { edge: e, sourceSide, targetSide, level, sourceLevelOffset, targetLevelOffset }
  })

  // Each lane entry remembers where the *other* end of its edge actually
  // sits, so the group can be ordered by that instead of by edge id.
  interface LaneEntry {
    edgeId: string
    otherPos: { x: number; y: number }
  }
  const laneGroups = new Map<string, LaneEntry[]>()
  // Sides a level edge has already claimed a point of (not always the exact
  // center - see sourceLevelOffset/targetLevelOffset above) - the proportional
  // split below has to steer every other edge on that same side around that
  // point instead of also landing on it, which an unclaimed side (or one
  // with only a single occupant, which centers itself by default too) would
  // otherwise do.
  const centerClaimed = new Map<string, number>()
  function addToLane(nodeId: string, side: HandleSide, edgeId: string, otherPos: { x: number; y: number }) {
    const key = `${nodeId}:${side}`
    const list = laneGroups.get(key) ?? []
    list.push({ edgeId, otherPos })
    laneGroups.set(key, list)
  }
  sides.forEach(({ edge, sourceSide, targetSide, level, sourceLevelOffset, targetLevelOffset }) => {
    // A level pair goes straight through its own shared point instead of
    // sharing the proportional lane split below - so it isn't thrown off by
    // however many other, unrelated edges happen to share that side, and
    // doesn't itself skew their split by occupying one of the slots.
    if (level) {
      centerClaimed.set(`${edge.source}:${sourceSide}`, sourceLevelOffset)
      centerClaimed.set(`${edge.target}:${targetSide}`, targetLevelOffset)
      return
    }
    const sourcePos = boxCenter(macroBoxes.get(edge.source) ?? boxOf(edge.source))
    const targetPos = boxCenter(macroBoxes.get(edge.target) ?? boxOf(edge.target))
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

  // How much of the middle to leave clear around a level edge's own claimed
  // point - e.g. 15 reserves claimed±15 so nothing else's line runs through
  // or right alongside it.
  const CENTER_GAP = 15

  function laneOffset(nodeId: string, side: HandleSide, edgeId: string, level: boolean, levelOffset: number): number {
    if (level) return levelOffset
    const list = laneGroups.get(`${nodeId}:${side}`) ?? [{ edgeId, otherPos: { x: 0, y: 0 } }]
    const index = list.findIndex((entry) => entry.edgeId === edgeId)
    const fraction = (index + 1) / (list.length + 1)
    const claimed = centerClaimed.get(`${nodeId}:${side}`)
    if (claimed === undefined) return fraction * 100
    // Squeeze the usual evenly-spaced spread into the two bands outside the
    // reserved point, instead of letting it land inside.
    const lowSpan = Math.max(0, claimed - CENTER_GAP)
    const highStart = Math.min(100, claimed + CENTER_GAP)
    const highSpan = 100 - highStart
    return fraction < 0.5 ? fraction * 2 * lowSpan : highStart + (fraction * 2 - 1) * highSpan
  }

  const edgeAnchors = new Map<string, { sourceHandle: string; targetHandle: string }>()
  const nodeHandles = new Map<string, NodeHandleSpec[]>()
  function ensureHandle(nodeId: string, side: HandleSide, offset: number) {
    const id = handleId(side, offset)
    const list = nodeHandles.get(nodeId) ?? []
    if (!list.some((h) => h.id === id)) list.push({ id, side, offset })
    nodeHandles.set(nodeId, list)
  }

  sides.forEach(({ edge, sourceSide, targetSide, level, sourceLevelOffset, targetLevelOffset }) => {
    const sourceOffset = laneOffset(edge.source, sourceSide, edge.id, level, sourceLevelOffset)
    const targetOffset = laneOffset(edge.target, targetSide, edge.id, level, targetLevelOffset)
    ensureHandle(edge.source, sourceSide, sourceOffset)
    ensureHandle(edge.target, targetSide, targetOffset)
    edgeAnchors.set(edge.id, { sourceHandle: handleId(sourceSide, sourceOffset), targetHandle: handleId(targetSide, targetOffset) })
  })

  return { edgeAnchors, nodeHandles }
}
