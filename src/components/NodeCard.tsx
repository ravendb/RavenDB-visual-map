import type { CSSProperties } from 'react'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../lib/categoryColors'
import type { NodeCategory } from '../data/architecture'

export interface NodeCardProps {
  label: string
  category: NodeCategory
  hasChildren: boolean
  needsReview?: boolean
  selected?: boolean
  flowState?: 'current' | 'visited'
  className?: string
  style?: CSSProperties
  onClick?: () => void
  onDoubleClick?: () => void
}

// The visual node card shared by the 2D (React Flow) and 3D views, so both
// render the exact same tag/label/meta markup instead of drifting apart.
export default function NodeCard({
  label,
  category,
  hasChildren,
  needsReview,
  selected,
  flowState,
  className,
  style,
  onClick,
  onDoubleClick,
}: NodeCardProps) {
  const color = CATEGORY_COLORS[category]
  const flowClass = flowState ? ` map-node--flow-${flowState}` : ''

  return (
    <div
      className={className ? `map-node ${className}${flowClass}` : `map-node${flowClass}`}
      style={{
        borderColor: color,
        boxShadow: selected ? `0 0 0 2px ${color}` : undefined,
        ...style,
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="map-node__tag" style={{ background: color }}>
        {CATEGORY_LABELS[category]}
      </div>
      <div className="map-node__label">{label}</div>
      <div className="map-node__meta">
        {hasChildren && <span className="map-node__expand">expand ↴</span>}
        {needsReview && (
          <span className="map-node__review" title="First pass - not yet reviewed by a subsystem expert">
            needs review
          </span>
        )}
      </div>
    </div>
  )
}
