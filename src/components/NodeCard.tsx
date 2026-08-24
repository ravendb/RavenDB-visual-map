import type { CSSProperties, ReactNode } from 'react'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../lib/categoryColors'
import type { NodeCategory } from '../data/architecture'

export interface NodeCardProps {
  label: string
  category: NodeCategory
  hasChildren: boolean
  selected?: boolean
  flowState?: 'current' | 'visited'
  /** True once this node's children are expanded in place - swaps the "expand" hint to "collapse". */
  expanded?: boolean
  className?: string
  style?: CSSProperties
  onClick?: () => void
  onDoubleClick?: () => void
  /** Rendered below the tag/label/meta row - used to show the expanded children grid. */
  children?: ReactNode
}

// The visual node card used by the 2D (React Flow) graph view.
export default function NodeCard({
  label,
  category,
  hasChildren,
  selected,
  flowState,
  expanded,
  className,
  style,
  onClick,
  onDoubleClick,
  children,
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
      {expanded && (
        <button type="button" className="map-node__close" data-node-close aria-label="Close and return to the map" title="Close">
          ×
        </button>
      )}
      <div className="map-node__tag" style={{ background: color }}>
        {CATEGORY_LABELS[category]}
      </div>
      <div className="map-node__label">{label}</div>
      <div className="map-node__meta">
        {hasChildren && <span className="map-node__expand">{expanded ? 'collapse ↑' : 'expand ↴'}</span>}
      </div>
      {children}
    </div>
  )
}
