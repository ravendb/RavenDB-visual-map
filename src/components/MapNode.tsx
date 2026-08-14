import { Handle, Position, type NodeProps } from '@xyflow/react'
import NodeCard from './NodeCard'
import type { NodeCategory } from '../data/architecture'

export interface MapNodeData {
  label: string
  category: NodeCategory
  hasChildren: boolean
  needsReview?: boolean
  flowState?: 'current' | 'visited'
  [key: string]: unknown
}

// One handle per side, each doubling as a source and a target, so an edge
// can leave/enter from whichever side actually points at the other node
// (see pickHandles in GraphView) instead of always top-to-bottom.
const SIDES = [
  { id: 'top', position: Position.Top },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
  { id: 'right', position: Position.Right },
]

export default function MapNode({ data, selected }: NodeProps) {
  const { label, category, hasChildren, needsReview, flowState } = data as MapNodeData

  return (
    <>
      {SIDES.map((side) => (
        <Handle key={`t-${side.id}`} type="target" id={side.id} position={side.position} style={{ opacity: 0 }} />
      ))}
      {SIDES.map((side) => (
        <Handle key={`s-${side.id}`} type="source" id={side.id} position={side.position} style={{ opacity: 0 }} />
      ))}
      <NodeCard
        label={label}
        category={category}
        hasChildren={hasChildren}
        needsReview={needsReview}
        selected={selected}
        flowState={flowState}
      />
    </>
  )
}
