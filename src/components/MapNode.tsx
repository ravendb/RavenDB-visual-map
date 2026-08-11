import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../lib/categoryColors'
import type { NodeCategory } from '../data/architecture'

export interface MapNodeData {
  label: string
  category: NodeCategory
  hasChildren: boolean
  needsReview?: boolean
  [key: string]: unknown
}

export default function MapNode({ data, selected }: NodeProps) {
  const { label, category, hasChildren, needsReview } = data as MapNodeData
  const color = CATEGORY_COLORS[category]

  return (
    <div
      className="map-node"
      style={{
        borderColor: color,
        boxShadow: selected ? `0 0 0 2px ${color}` : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <div className="map-node__tag" style={{ background: color }}>
        {CATEGORY_LABELS[category]}
      </div>
      <div className="map-node__label">{label}</div>
      <div className="map-node__meta">
        {hasChildren && <span className="map-node__expand">expand ↴</span>}
        {needsReview && <span className="map-node__review" title="First pass - not yet reviewed by a subsystem expert">needs review</span>}
      </div>
    </div>
  )
}
