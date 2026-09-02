import { memo } from 'react'
import { BaseEdge, Position, getSmoothStepPath, type EdgeProps, type SmoothStepPathOptions } from '@xyflow/react'

interface Point {
  x: number
  y: number
}
interface Dir {
  x: number
  y: number
}

const DIR: Record<Position, Dir> = {
  [Position.Left]: { x: -1, y: 0 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Top]: { x: 0, y: -1 },
  [Position.Bottom]: { x: 0, y: 1 },
}

// Mirrors @xyflow/system's internal corner selection for a "mixed" handle
// pair (source horizontal, target vertical, or vice versa) - the shape
// virtually every non-straight edge on this hand-placed map takes. Needed to
// know exactly where the rendered smoothstep path actually bends, so the
// label can be placed on the shorter, less-crowded leg below instead of
// xyflow's default (centered on the *longer* leg) - which on a hand-placed
// layout can coincidentally land right on top of an unrelated straight edge
// running through the same row/column, reading as a kink in that other line.
// Returns null for an "opposite handles" pair (e.g. left-right, top-bottom) -
// those are genuinely straight or default-bend already and need no override.
function mixedCorner(source: Point, sourcePos: Position, target: Point, targetPos: Position, offset: number): Point | null {
  const sourceDir = DIR[sourcePos]
  const targetDir = DIR[targetPos]
  const sourceGapped = { x: source.x + sourceDir.x * offset, y: source.y + sourceDir.y * offset }
  const targetGapped = { x: target.x + targetDir.x * offset, y: target.y + targetDir.y * offset }
  const dir: Dir =
    sourcePos === Position.Left || sourcePos === Position.Right
      ? { x: sourceGapped.x < targetGapped.x ? 1 : -1, y: 0 }
      : { x: 0, y: sourceGapped.y < targetGapped.y ? 1 : -1 }
  const dirAccessor: 'x' | 'y' = dir.x !== 0 ? 'x' : 'y'
  const currDir = dir[dirAccessor]
  if (sourceDir[dirAccessor] * targetDir[dirAccessor] === -1) return null
  const sourceTarget = { x: sourceGapped.x, y: targetGapped.y }
  const targetSource = { x: targetGapped.x, y: sourceGapped.y }
  let point = dirAccessor === 'x' ? (sourceDir.x === currDir ? targetSource : sourceTarget) : sourceDir.y === currDir ? sourceTarget : targetSource
  if (sourcePos !== targetPos) {
    const oppAcc: 'x' | 'y' = dirAccessor === 'x' ? 'y' : 'x'
    const isSameDir = sourceDir[dirAccessor] === targetDir[oppAcc]
    const sourceGt = sourceGapped[oppAcc] > targetGapped[oppAcc]
    const sourceLt = sourceGapped[oppAcc] < targetGapped[oppAcc]
    const flip =
      (sourceDir[dirAccessor] === 1 && ((!isSameDir && sourceGt) || (isSameDir && sourceLt))) ||
      (sourceDir[dirAccessor] !== 1 && ((!isSameDir && sourceLt) || (isSameDir && sourceGt)))
    if (flip) point = dirAccessor === 'x' ? sourceTarget : targetSource
  }
  return point
}

function MapEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  style,
  markerEnd,
  markerStart,
  interactionWidth,
  pathOptions,
}: EdgeProps) {
  const options = pathOptions as SmoothStepPathOptions | undefined
  const offset = options?.offset ?? 20
  const [path, defaultLabelX, defaultLabelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: options?.borderRadius,
    offset: options?.offset,
    stepPosition: options?.stepPosition,
  })

  const corner = mixedCorner({ x: sourceX, y: sourceY }, sourcePosition, { x: targetX, y: targetY }, targetPosition, offset)
  let labelX = defaultLabelX
  let labelY = defaultLabelY
  if (corner) {
    const sourceLeg = Math.hypot(corner.x - sourceX, corner.y - sourceY)
    const targetLeg = Math.hypot(targetX - corner.x, targetY - corner.y)
    const onSourceLeg = sourceLeg <= targetLeg
    labelX = onSourceLeg ? (sourceX + corner.x) / 2 : (corner.x + targetX) / 2
    labelY = onSourceLeg ? (sourceY + corner.y) / 2 : (corner.y + targetY) / 2
  }

  return (
    <BaseEdge
      path={path}
      labelX={labelX}
      labelY={labelY}
      label={label}
      labelStyle={labelStyle}
      labelShowBg={labelShowBg}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      style={style}
      markerEnd={markerEnd}
      markerStart={markerStart}
      interactionWidth={interactionWidth}
    />
  )
}

export default memo(MapEdge)
