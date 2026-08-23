import { Handle, Position, type NodeProps } from '@xyflow/react'
import NodeCard from './NodeCard'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../lib/categoryColors'
import type { NodeCategory } from '../data/architecture'

export type HandleSide = 'top' | 'bottom' | 'left' | 'right'

export interface NodeHandleSpec {
  /** Unique per node; referenced by an edge's sourceHandle/targetHandle. */
  id: string
  side: HandleSide
  /** Percent (0-100) along the side, so several edges on one side fan out instead of stacking on one point. */
  offset: number
}

export interface ChildSummary {
  id: string
  label: string
  category: NodeCategory
  summary: string
  /** Whether this child has an inline code preview available (a specific file/line, not just a folder). */
  hasCodeRef?: boolean
}

export interface MapNodeData {
  label: string
  category: NodeCategory
  hasChildren: boolean
  flowState?: 'current' | 'visited'
  /** Computed per-diagram in GraphView so edges get a distinct anchor per lane; falls back to one centered handle per side. */
  handles?: NodeHandleSpec[]
  /** True while this node's children are shown expanded in place on the map. */
  expanded?: boolean
  /** This node's children, only needed while expanded. */
  children?: ChildSummary[]
  /** The child currently open in the detail panel, if any, so its card can be highlighted. */
  selectedChildId?: string
  /** True while a different node is expanded, to push everything else visually into the background. */
  dimmed?: boolean
  [key: string]: unknown
}

const SIDE_POSITION: Record<HandleSide, Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
}

const DEFAULT_HANDLES: NodeHandleSpec[] = [
  { id: 'top', side: 'top', offset: 50 },
  { id: 'bottom', side: 'bottom', offset: 50 },
  { id: 'left', side: 'left', offset: 50 },
  { id: 'right', side: 'right', offset: 50 },
]

function handleStyle(side: HandleSide, offset: number) {
  return side === 'top' || side === 'bottom' ? { left: `${offset}%`, opacity: 0 } : { top: `${offset}%`, opacity: 0 }
}

export default function MapNode({ data, selected }: NodeProps) {
  const { label, category, hasChildren, flowState, handles, expanded, children, selectedChildId, dimmed } =
    data as MapNodeData
  const specs = handles && handles.length > 0 ? handles : DEFAULT_HANDLES

  return (
    <>
      {specs.map((h) => (
        <Handle key={`t-${h.id}`} type="target" id={h.id} position={SIDE_POSITION[h.side]} style={handleStyle(h.side, h.offset)} />
      ))}
      {specs.map((h) => (
        <Handle key={`s-${h.id}`} type="source" id={h.id} position={SIDE_POSITION[h.side]} style={handleStyle(h.side, h.offset)} />
      ))}
      <NodeCard
        label={label}
        category={category}
        hasChildren={hasChildren}
        selected={selected}
        flowState={flowState}
        expanded={expanded}
        className={expanded ? 'map-node--expanded' : undefined}
        style={dimmed ? { opacity: 0.35 } : undefined}
      >
        {expanded && children && children.length > 0 && (
          <div className="map-node__children">
            {children.map((child) => (
              <button
                key={child.id}
                type="button"
                className={child.id === selectedChildId ? 'map-node__child map-node__child--selected' : 'map-node__child'}
                data-child-id={child.id}
                style={{ borderColor: CATEGORY_COLORS[child.category] }}
              >
                <div className="map-node__child-head">
                  <span className="map-node__child-tag" style={{ background: CATEGORY_COLORS[child.category] }}>
                    {CATEGORY_LABELS[child.category]}
                  </span>
                  {child.hasCodeRef && (
                    <span className="map-node__child-code" title="Has an inline code preview">
                      {'</>'}
                    </span>
                  )}
                </div>
                <span className="map-node__child-label">{child.label}</span>
                <span className="map-node__child-summary">{child.summary}</span>
              </button>
            ))}
          </div>
        )}
      </NodeCard>
    </>
  )
}
