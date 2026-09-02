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
// How far to the left of a blocking obstacle a detoured vertical edge clears
// it by, and how close to the target's own edge the detour's turn sits (kept
// small so most of the run stays a straight hug, with only a short jog right
// before turning into the target).
const DETOUR_CLEARANCE = 20
const DETOUR_BEND_MARGIN = 20

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

// Does a straight segment at `fixed` along `orientation` - e.g. a horizontal
// run at y=fixed - spanning [rangeMin, rangeMax] on the other axis, cut
// through the interior of any obstacle? Unlike hugCrossesObstacle (which
// only ever checks the long "hug" run and assumes the short turn at the far
// end is safe), this checks one concrete segment - used below to validate
// *both* legs of an L-shaped route, since the turn leg is only actually
// short when the far node isn't itself embedded in a big obstacle's own
// row/column.
function segmentBlocked(orientation: 'horizontal' | 'vertical', fixed: number, rangeMin: number, rangeMax: number, obstacles: Box[]): boolean {
  return obstacles.some((box) => {
    if (orientation === 'horizontal') {
      const crossesY = fixed > box.y && fixed < box.y + box.height
      return crossesY && rangeOverlap(rangeMin, rangeMax, box.x, box.x + box.width)
    }
    const crossesX = fixed > box.x && fixed < box.x + box.width
    return crossesX && rangeOverlap(rangeMin, rangeMax, box.y, box.y + box.height)
  })
}

// Row-hug shape: source exits left/right at its own row, travels to target's
// column, then turns up/down into target. Checks both legs - the horizontal
// run at source's row, and the vertical turn at target's column.
function rowHugBlocked(sourceBox: Box, targetBox: Box, obstacles: Box[]): boolean {
  const sourceCenter = boxCenter(sourceBox)
  const targetCenter = boxCenter(targetBox)
  const xMin = Math.min(sourceBox.x, targetBox.x)
  const xMax = Math.max(sourceBox.x + sourceBox.width, targetBox.x + targetBox.width)
  const yMin = Math.min(sourceCenter.y, targetCenter.y)
  const yMax = Math.max(sourceCenter.y, targetCenter.y)
  return (
    segmentBlocked('horizontal', sourceCenter.y, xMin, xMax, obstacles) || segmentBlocked('vertical', targetCenter.x, yMin, yMax, obstacles)
  )
}

// A vertically-level pair (source and target's x-ranges overlap, so the
// straight-down line between them shares a single x) can still have a third
// node sitting directly in that column - e.g. TransactionMerger, centered in
// the exact same column as both Storages above it and the Storage Engine
// below. Unlike the general dominant-axis case, a level pair never bends, so
// it needs its own detour: hug a column just left of the obstacle for most of
// the run, then jog back right into the target right before entering it, in
// whatever clear gap sits between the obstacle and the target.
function verticalDetour(
  sourceBox: Box,
  targetBox: Box,
  lo: number,
  hi: number,
  obstacles: Box[],
): { sourceOffset: number; targetOffset: number; stepPosition: number } | undefined {
  const travelMin = Math.min(sourceBox.y + sourceBox.height, targetBox.y)
  const travelMax = Math.max(sourceBox.y + sourceBox.height, targetBox.y)
  const blocker = obstacles.find(
    (box) => rangeOverlap(lo, hi, box.x, box.x + box.width) && rangeOverlap(travelMin, travelMax, box.y, box.y + box.height),
  )
  if (!blocker) return undefined
  const shared = (lo + hi) / 2
  const detourX = Math.max(sourceBox.x + 4, blocker.x - DETOUR_CLEARANCE)
  const sourceOnTop = sourceBox.y < targetBox.y
  const bendY = sourceOnTop
    ? Math.max(blocker.y + blocker.height + DETOUR_BEND_MARGIN, targetBox.y - DETOUR_BEND_MARGIN)
    : Math.min(blocker.y - DETOUR_BEND_MARGIN, targetBox.y + targetBox.height + DETOUR_BEND_MARGIN)
  const sourceHandleY = sourceOnTop ? sourceBox.y + sourceBox.height : sourceBox.y
  const targetHandleY = sourceOnTop ? targetBox.y : targetBox.y + targetBox.height
  const span = targetHandleY - sourceHandleY
  const fraction = span !== 0 ? (bendY - sourceHandleY) / span : 0.5
  return {
    sourceOffset: Math.min(96, Math.max(4, ((detourX - sourceBox.x) / sourceBox.width) * 100)),
    targetOffset: Math.min(96, Math.max(4, ((shared - targetBox.x) / targetBox.width) * 100)),
    stepPosition: Math.min(0.92, Math.max(0.08, fraction)),
  }
}

// Column-hug shape: source exits top/bottom at its own column, travels to
// target's row, then turns left/right into target. Mirror of rowHugBlocked.
function columnHugBlocked(sourceBox: Box, targetBox: Box, obstacles: Box[]): boolean {
  const sourceCenter = boxCenter(sourceBox)
  const targetCenter = boxCenter(targetBox)
  const yMin = Math.min(sourceBox.y, targetBox.y)
  const yMax = Math.max(sourceBox.y + sourceBox.height, targetBox.y + targetBox.height)
  const xMin = Math.min(sourceCenter.x, targetCenter.x)
  const xMax = Math.max(sourceCenter.x, targetCenter.x)
  return (
    segmentBlocked('vertical', sourceCenter.x, yMin, yMax, obstacles) || segmentBlocked('horizontal', targetCenter.y, xMin, xMax, obstacles)
  )
}

// Z-shaped last resort: source exits its own row/column at the edge facing
// target, jogs the middle leg through some clear corridor between the two
// boxes, then turns the rest of the way into target's own facing side. Used
// only when both rowHug and columnHug are blocked - e.g. a source and
// target that sit in entirely different row *and* column stacks, so neither
// hug's single bend can dodge a third node embedded in one of those stacks
// (Storages -> Integrations passes both ETL/Sinks, stacked directly above
// Integrations in its column, and TransactionMerger, sitting in Storages'
// own column below it).
//
// The corridor's obvious first choice is its midpoint (also what
// assignLanes' default center-of-box handle offset and 0.5 stepPosition
// produce when nothing overrides them), but a third node can occupy that
// exact midpoint while leaving the rest of the gap clear - e.g. Clustering,
// sitting between Storages and Replication - so this searches outward from
// the midpoint for any coordinate where all three legs are clear, instead
// of giving up on the whole shape the moment the midpoint itself is blocked.
// Returns the chosen bend coordinate (an x for a 'x'-dominant pair, a y for
// 'y'-dominant), or undefined if no clear coordinate exists anywhere in the
// gap.
function crossAxisDetourBend(sourceBox: Box, targetBox: Box, obstacles: Box[], dominant: 'x' | 'y'): number | undefined {
  const sourceCenter = boxCenter(sourceBox)
  const targetCenter = boxCenter(targetBox)
  const forward = dominant === 'x' ? targetCenter.x > sourceCenter.x : targetCenter.y > sourceCenter.y
  const sourceEdge =
    dominant === 'x'
      ? forward
        ? sourceBox.x + sourceBox.width
        : sourceBox.x
      : forward
        ? sourceBox.y + sourceBox.height
        : sourceBox.y
  const targetEdge =
    dominant === 'x' ? (forward ? targetBox.x : targetBox.x + targetBox.width) : forward ? targetBox.y : targetBox.y + targetBox.height
  const gapMin = Math.min(sourceEdge, targetEdge)
  const gapMax = Math.max(sourceEdge, targetEdge)
  const crossMin = dominant === 'x' ? Math.min(sourceCenter.y, targetCenter.y) : Math.min(sourceCenter.x, targetCenter.x)
  const crossMax = dominant === 'x' ? Math.max(sourceCenter.y, targetCenter.y) : Math.max(sourceCenter.x, targetCenter.x)
  function segmentsClear(bend: number): boolean {
    if (dominant === 'x') {
      return (
        !segmentBlocked('horizontal', sourceCenter.y, Math.min(sourceEdge, bend), Math.max(sourceEdge, bend), obstacles) &&
        !segmentBlocked('vertical', bend, crossMin, crossMax, obstacles) &&
        !segmentBlocked('horizontal', targetCenter.y, Math.min(bend, targetEdge), Math.max(bend, targetEdge), obstacles)
      )
    }
    return (
      !segmentBlocked('vertical', sourceCenter.x, Math.min(sourceEdge, bend), Math.max(sourceEdge, bend), obstacles) &&
      !segmentBlocked('horizontal', bend, crossMin, crossMax, obstacles) &&
      !segmentBlocked('vertical', targetCenter.x, Math.min(bend, targetEdge), Math.max(bend, targetEdge), obstacles)
    )
  }
  const midpoint = (sourceEdge + targetEdge) / 2
  if (segmentsClear(midpoint)) return midpoint
  // The midpoint's blocked - try just past whichever obstacle(s) actually
  // sit in the gap, on either side of it, closest to the midpoint first.
  const candidates = obstacles
    .filter((box) => {
      const boxMin = dominant === 'x' ? box.x : box.y
      const boxMax = dominant === 'x' ? box.x + box.width : box.y + box.height
      return rangeOverlap(gapMin, gapMax, boxMin, boxMax)
    })
    .flatMap((box) => {
      const boxMin = dominant === 'x' ? box.x : box.y
      const boxMax = dominant === 'x' ? box.x + box.width : box.y + box.height
      return [boxMin - DETOUR_CLEARANCE, boxMax + DETOUR_CLEARANCE]
    })
    .filter((c) => c > gapMin + 4 && c < gapMax - 4)
    .sort((a, b) => Math.abs(a - midpoint) - Math.abs(b - midpoint))
  return candidates.find(segmentsClear)
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
  // midpoint bend - two turns - so hug the dominant axis instead, keeping
  // the long straight run in source's own row/column and turning into
  // target via the minor axis once alongside it. One turn instead of two.
  // Both legs of that L get checked - the long hug run *and* the short turn
  // at the far end - since the turn is only actually short when the far
  // node isn't itself sitting inside a big obstacle's own row/column (a
  // large permanently-expanded hub square in the middle of the map can
  // block the turn leg even while the hug leg runs clear past it). If the
  // preferred shape is blocked, try the other orientation before giving up
  // to the obstacle-blind fallback below.
  const rowHug = { sourceSide: (dx > 0 ? 'right' : 'left') as HandleSide, targetSide: (dy > 0 ? 'top' : 'bottom') as HandleSide }
  const columnHug = { sourceSide: (dy > 0 ? 'bottom' : 'top') as HandleSide, targetSide: (dx > 0 ? 'left' : 'right') as HandleSide }
  if (absDx > absDy) {
    if (!rowHugBlocked(sourceBox, targetBox, obstacles)) return rowHug
    if (!columnHugBlocked(sourceBox, targetBox, obstacles)) return columnHug
    if (crossAxisDetourBend(sourceBox, targetBox, obstacles, 'x') !== undefined) {
      return { sourceSide: dx > 0 ? 'right' : 'left', targetSide: dx > 0 ? 'left' : 'right' }
    }
  } else {
    if (!columnHugBlocked(sourceBox, targetBox, obstacles)) return columnHug
    if (!rowHugBlocked(sourceBox, targetBox, obstacles)) return rowHug
    if (crossAxisDetourBend(sourceBox, targetBox, obstacles, 'y') !== undefined) {
      return { sourceSide: dy > 0 ? 'bottom' : 'top', targetSide: dy > 0 ? 'top' : 'bottom' }
    }
  }
  return absDx > absDy ? rowHug : columnHug
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
): {
  edgeAnchors: Map<string, { sourceHandle: string; targetHandle: string; pathOptions: { offset: number; stepPosition?: number } }>
  nodeHandles: Map<string, NodeHandleSpec[]>
} {
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
    // The axis a level pair is aligned along, and the shared absolute
    // coordinate on that axis both ends currently attach at - kept (not just
    // the two derived percentages) so a later collision-spread pass can shift
    // *one* absolute point and re-derive both ends' percentages from it,
    // rather than shifting each end's percentage independently and letting a
    // straight line go diagonal when only one end collides with something.
    let levelAxis: 'x' | 'y' | undefined
    let levelShared = 0
    // A forced route overrides the normal level/lane machinery entirely: a
    // fixed source offset, target offset and bend position, used when a
    // level pair's straight line is blocked by a third node sitting right in
    // its shared column (see verticalDetour) - kept separate from `level` so
    // the collision-spread pass below (which re-derives both ends from a
    // single shared coordinate) can't clobber it.
    let forced: { sourceOffset: number; targetOffset: number; stepPosition: number } | undefined
    // Like `forced`, but overrides only the bend position, leaving both
    // ends' offsets to the normal lane-group flow - see the bothHorizontal
    // Z-shape branch below.
    let forcedStep: number | undefined
    if (bothHorizontal && rangeOverlap(sourceBox.y, sourceBox.y + sourceBox.height, targetBox.y, targetBox.y + targetBox.height)) {
      const lo = Math.max(sourceBox.y, targetBox.y)
      const hi = Math.min(sourceBox.y + sourceBox.height, targetBox.y + targetBox.height)
      const shared = (lo + hi) / 2
      sourceLevelOffset = ((shared - sourceBox.y) / sourceBox.height) * 100
      targetLevelOffset = ((shared - targetBox.y) / targetBox.height) * 100
      level = true
      levelAxis = 'y'
      levelShared = shared
    } else if (bothVertical && rangeOverlap(sourceBox.x, sourceBox.x + sourceBox.width, targetBox.x, targetBox.x + targetBox.width)) {
      const lo = Math.max(sourceBox.x, targetBox.x)
      const hi = Math.min(sourceBox.x + sourceBox.width, targetBox.x + targetBox.width)
      const detour = verticalDetour(sourceBox, targetBox, lo, hi, obstacles)
      if (detour) {
        forced = detour
      } else {
        const shared = (lo + hi) / 2
        sourceLevelOffset = ((shared - sourceBox.x) / sourceBox.width) * 100
        targetLevelOffset = ((shared - targetBox.x) / targetBox.width) * 100
        level = true
        levelAxis = 'x'
        levelShared = shared
      }
    } else if (bothHorizontal) {
      // Z-shape (see crossAxisDetourBend): no shared row to run level
      // through, so the bend needs an explicit clear column rather than the
      // geometric midpoint getSmoothStepPath's default stepPosition (0.5)
      // would otherwise land on - which can sit inside a third node
      // occupying part of the gap. Only the bend moves here (via
      // `forcedStep`, below) - the handle offsets on either end stay in the
      // normal lane-group flow, so several Z-shaped edges sharing the same
      // hub side (e.g. Storages' right side carrying both this and the
      // straight-line-blocked "change feed" edge to Replication) still
      // spread across it instead of all pinning to dead center and
      // overlapping each other.
      const bend = crossAxisDetourBend(sourceBox, targetBox, obstacles, 'x')
      if (bend !== undefined) {
        const forward = sourceSide === 'right'
        const sourceHandleX = forward ? sourceBox.x + sourceBox.width : sourceBox.x
        const targetHandleX = forward ? targetBox.x : targetBox.x + targetBox.width
        const span = targetHandleX - sourceHandleX
        const fraction = span !== 0 ? (bend - sourceHandleX) / span : 0.5
        forcedStep = Math.min(0.92, Math.max(0.08, fraction))
      }
    } else if (bothVertical) {
      // Mirror of the bothHorizontal Z-shape above, for a y-dominant pair.
      const bend = crossAxisDetourBend(sourceBox, targetBox, obstacles, 'y')
      if (bend !== undefined) {
        const forward = sourceSide === 'bottom'
        const sourceHandleY = forward ? sourceBox.y + sourceBox.height : sourceBox.y
        const targetHandleY = forward ? targetBox.y : targetBox.y + targetBox.height
        const span = targetHandleY - sourceHandleY
        const fraction = span !== 0 ? (bend - sourceHandleY) / span : 0.5
        forcedStep = Math.min(0.92, Math.max(0.08, fraction))
      }
    }
    return { edge: e, sourceSide, targetSide, level, sourceLevelOffset, targetLevelOffset, levelAxis, levelShared, forced, forcedStep }
  })

  // A level edge's offset is derived purely from its own source/target box
  // geometry, with no awareness of any other edge - so two level edges that
  // share a node+side (e.g. one hub straight-through to two different
  // targets that happen to sit in the same column, one above the other)
  // compute the exact same point and run on top of each other for their
  // entire shared span instead of merely crossing near it. Spread every such
  // colliding group evenly around their shared point so they read as
  // parallel lines from the moment they leave the shared node - but do it as
  // ONE shift of the shared absolute coordinate per edge, applied to *both*
  // ends via union-find over the source-side and target-side collision keys.
  // Shifting each end from an independently-computed group would move one
  // end of an edge without moving the other whenever it only collides at one
  // end (e.g. Storages' straight-down edges to TransactionMerger and to
  // Storage Engine collide with each other only at the Storages end) -
  // turning an otherwise-straight line diagonal instead of just shifting it
  // sideways.
  const LEVEL_SPREAD = 14
  const levelIndices = sides.map((_, i) => i).filter((i) => sides[i].level)
  const parent = new Map<number, number>(levelIndices.map((i) => [i, i]))
  function find(i: number): number {
    let root = i
    while (parent.get(root) !== root) root = parent.get(root)!
    let cur = i
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!
      parent.set(cur, root)
      cur = next
    }
    return root
  }
  function union(a: number, b: number) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  // Sharing a `{node}:{side}` key alone isn't enough to union two edges - a
  // hub can have several level edges leaving the same side toward targets in
  // completely different bands (e.g. Storages' bottom side carries both the
  // dead-straight run down to TransactionMerger *and* a mostly-diagonal-
  // anyway run over to Clustering, whose "shared" x sits far to the right).
  // Only union edges whose shared coordinate is already close enough that
  // they'd actually run on top of each other without a nudge.
  const LEVEL_COLLIDE_THRESHOLD = 60
  const entriesByKey = new Map<string, number[]>()
  levelIndices.forEach((i) => {
    const s = sides[i]
    ;[`${s.edge.source}:${s.sourceSide}`, `${s.edge.target}:${s.targetSide}`].forEach((key) => {
      const existing = entriesByKey.get(key) ?? []
      const collider = existing.find((j) => Math.abs(sides[j].levelShared - s.levelShared) < LEVEL_COLLIDE_THRESHOLD)
      if (collider !== undefined) union(collider, i)
      existing.push(i)
      entriesByKey.set(key, existing)
    })
  })
  const groups = new Map<number, number[]>()
  levelIndices.forEach((i) => {
    const root = find(i)
    groups.set(root, [...(groups.get(root) ?? []), i])
  })
  groups.forEach((indices) => {
    if (indices.length < 2) return
    indices.sort((a, b) => sides[a].edge.id.localeCompare(sides[b].edge.id))
    const base = sides[indices[0]].levelShared
    const start = base - (LEVEL_SPREAD * (indices.length - 1)) / 2
    indices.forEach((i, order) => {
      const s = sides[i]
      const shared = start + order * LEVEL_SPREAD
      const sourceBox = macroBoxes.get(s.edge.source) ?? boxOf(s.edge.source)
      const targetBox = macroBoxes.get(s.edge.target) ?? boxOf(s.edge.target)
      if (s.levelAxis === 'x') {
        s.sourceLevelOffset = Math.min(96, Math.max(4, ((shared - sourceBox.x) / sourceBox.width) * 100))
        s.targetLevelOffset = Math.min(96, Math.max(4, ((shared - targetBox.x) / targetBox.width) * 100))
      } else {
        s.sourceLevelOffset = Math.min(96, Math.max(4, ((shared - sourceBox.y) / sourceBox.height) * 100))
        s.targetLevelOffset = Math.min(96, Math.max(4, ((shared - targetBox.y) / targetBox.height) * 100))
      }
    })
  })

  // Each lane entry remembers where the *other* end of its edge actually
  // sits, so the group can be ordered by that instead of by edge id.
  interface LaneEntry {
    edgeId: string
    otherPos: { x: number; y: number }
  }
  const laneGroups = new Map<string, LaneEntry[]>()
  // Points a level edge has already claimed on a given side (not always the
  // exact center - see sourceLevelOffset/targetLevelOffset above) - the
  // proportional split below has to steer every other edge on that same
  // side around all of them instead of also landing on one, which an
  // unclaimed side (or one with only a single occupant, which centers
  // itself by default too) would otherwise do. A side can have more than
  // one level edge (e.g. two separate straight-through connections to the
  // same hub), so each claim is appended rather than replacing the last.
  const centerClaimed = new Map<string, number[]>()
  function addToLane(nodeId: string, side: HandleSide, edgeId: string, otherPos: { x: number; y: number }) {
    const key = `${nodeId}:${side}`
    const list = laneGroups.get(key) ?? []
    list.push({ edgeId, otherPos })
    laneGroups.set(key, list)
  }
  sides.forEach(({ edge, sourceSide, targetSide, level, sourceLevelOffset, targetLevelOffset, forced }) => {
    // A forced (detoured) edge, like a level pair, owns a fixed point on each
    // side rather than sharing the proportional lane split below.
    if (forced) {
      const sourceKey = `${edge.source}:${sourceSide}`
      const targetKey = `${edge.target}:${targetSide}`
      centerClaimed.set(sourceKey, [...(centerClaimed.get(sourceKey) ?? []), forced.sourceOffset])
      centerClaimed.set(targetKey, [...(centerClaimed.get(targetKey) ?? []), forced.targetOffset])
      return
    }
    // A level pair goes straight through its own shared point instead of
    // sharing the proportional lane split below - so it isn't thrown off by
    // however many other, unrelated edges happen to share that side, and
    // doesn't itself skew their split by occupying one of the slots.
    if (level) {
      const sourceKey = `${edge.source}:${sourceSide}`
      const targetKey = `${edge.target}:${targetSide}`
      centerClaimed.set(sourceKey, [...(centerClaimed.get(sourceKey) ?? []), sourceLevelOffset])
      centerClaimed.set(targetKey, [...(centerClaimed.get(targetKey) ?? []), targetLevelOffset])
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
    const claimed = (centerClaimed.get(`${nodeId}:${side}`) ?? []).slice().sort((a, b) => a - b)
    if (claimed.length === 0) return fraction * 100
    // Squeeze the usual evenly-spaced spread into the bands left between
    // (and around) every reserved point, instead of letting it land on one.
    const bands: [number, number][] = []
    let cursor = 0
    for (const point of claimed) {
      bands.push([cursor, Math.max(cursor, point - CENTER_GAP)])
      cursor = Math.max(cursor, Math.min(100, point + CENTER_GAP))
    }
    bands.push([cursor, 100])
    const spans = bands.map(([lo, hi]) => hi - lo)
    const totalSpan = spans.reduce((sum, span) => sum + span, 0)
    if (totalSpan <= 0) return fraction * 100
    let remaining = fraction * totalSpan
    for (let i = 0; i < bands.length; i++) {
      if (remaining <= spans[i] || i === bands.length - 1) return bands[i][0] + remaining
      remaining -= spans[i]
    }
    return fraction * 100
  }

  // Where a lane group's edges bend defaults to the exact geometric midpoint
  // between the two boxes (getSmoothStepPath's stepPosition: 0.5) - fine for
  // a single edge, but every edge sharing a hub's side toward the same
  // general direction (e.g. several right-column nodes all above a hub) also
  // shares that midpoint, so their vertical (or horizontal) runs land on the
  // exact same line and overlap for however much of their length coincides,
  // even though ensureHandle already spread their exit points apart. Reusing
  // each lane's own fraction to also spread *where the bend happens* - same
  // idea as the offset spread above, just along the other dimension - keeps
  // every edge in a shared lane on a visibly distinct line end to end.
  function laneFraction(nodeId: string, side: HandleSide, edgeId: string): { fraction: number; groupSize: number } {
    const list = laneGroups.get(`${nodeId}:${side}`) ?? [{ edgeId, otherPos: { x: 0, y: 0 } }]
    const index = list.findIndex((entry) => entry.edgeId === edgeId)
    return { fraction: (index + 1) / (list.length + 1), groupSize: list.length }
  }
  function stepPositionFor(edge: RoutableEdge, sourceSide: HandleSide, targetSide: HandleSide, level: boolean): number | undefined {
    if (level) return undefined
    // Horizontal-only: a shared vertical trunk between a hub and a column of
    // nodes off to one side (its usual source) sits in open space, so moving
    // its bend is safe. A shared *vertical* lane's own column is exactly
    // where pickSides already routed a bend around a real obstacle (e.g. a
    // node sitting directly beneath the hub) - moving that bend without
    // re-checking hugCrossesObstacle could route it straight through what it
    // was avoiding, so vertical lanes keep the plain geometric midpoint.
    const bothHorizontal = (sourceSide === 'left' || sourceSide === 'right') && (targetSide === 'left' || targetSide === 'right')
    if (!bothHorizontal) return undefined
    const sourceLane = laneFraction(edge.source, sourceSide, edge.id)
    const targetLane = laneFraction(edge.target, targetSide, edge.id)
    const hubIsSource = sourceLane.groupSize >= targetLane.groupSize
    const hub = hubIsSource ? sourceLane : targetLane
    if (hub.groupSize <= 1) return undefined
    // Spread bends across the middle 50% of the path (0.25-0.75) rather than
    // the extremes, where a bend right at a handle would look like a kink.
    const distanceFromHub = 0.25 + hub.fraction * 0.5
    return hubIsSource ? distanceFromHub : 1 - distanceFromHub
  }

  const edgeAnchors = new Map<string, { sourceHandle: string; targetHandle: string; pathOptions: { offset: number; stepPosition?: number } }>()
  const nodeHandles = new Map<string, NodeHandleSpec[]>()
  function ensureHandle(nodeId: string, side: HandleSide, offset: number) {
    const id = handleId(side, offset)
    const list = nodeHandles.get(nodeId) ?? []
    if (!list.some((h) => h.id === id)) list.push({ id, side, offset })
    nodeHandles.set(nodeId, list)
  }

  sides.forEach(({ edge, sourceSide, targetSide, level, sourceLevelOffset, targetLevelOffset, forced, forcedStep }) => {
    const sourceOffset = forced ? forced.sourceOffset : laneOffset(edge.source, sourceSide, edge.id, level, sourceLevelOffset)
    const targetOffset = forced ? forced.targetOffset : laneOffset(edge.target, targetSide, edge.id, level, targetLevelOffset)
    ensureHandle(edge.source, sourceSide, sourceOffset)
    ensureHandle(edge.target, targetSide, targetOffset)
    const stepPosition = forced ? forced.stepPosition : (forcedStep ?? stepPositionFor(edge, sourceSide, targetSide, level))
    edgeAnchors.set(edge.id, {
      sourceHandle: handleId(sourceSide, sourceOffset),
      targetHandle: handleId(targetSide, targetOffset),
      // getSmoothStepPath's own default `offset` (20) leaves a visible gap
      // between the line and the node it's supposedly attached to - zero it
      // out so every edge actually touches the tile it connects to.
      pathOptions: { offset: 0, ...(stepPosition === undefined ? {} : { stepPosition }) },
    })
  })

  return { edgeAnchors, nodeHandles }
}
