import { getNode, type MapEdge } from '../data/architecture'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../lib/categoryColors'
import { highlightTerms } from '../lib/highlightTerms'

interface EdgeDetailContentProps {
  edge: MapEdge
  onSelectNode: (id: string) => void
}

export default function EdgeDetailContent({ edge, onSelectNode }: EdgeDetailContentProps) {
  const source = getNode(edge.source)
  const target = getNode(edge.target)
  if (!source || !target) return null

  return (
    <>
      {edge.label && <div className="detail-panel__edge-label">{edge.label}</div>}
      <h2 className="detail-panel__edge-title">
        <button type="button" className="detail-panel__edge-node" onClick={() => onSelectNode(source.id)}>
          {source.label}
        </button>
        <span className="detail-panel__edge-arrow" aria-hidden="true">
          →
        </span>
        <button type="button" className="detail-panel__edge-node" onClick={() => onSelectNode(target.id)}>
          {target.label}
        </button>
      </h2>

      {edge.description && <p className="detail-panel__description">{highlightTerms(edge.description)}</p>}

      <div className="detail-panel__edge-side">
        <div className="detail-panel__tag" style={{ background: CATEGORY_COLORS[source.category] }}>
          {CATEGORY_LABELS[source.category]}
        </div>
        <h3 className="detail-panel__edge-side-title">{source.label}</h3>
        <p className="detail-panel__summary">{highlightTerms(source.summary)}</p>
      </div>

      <div className="detail-panel__edge-side">
        <div className="detail-panel__tag" style={{ background: CATEGORY_COLORS[target.category] }}>
          {CATEGORY_LABELS[target.category]}
        </div>
        <h3 className="detail-panel__edge-side-title">{target.label}</h3>
        <p className="detail-panel__summary">{highlightTerms(target.summary)}</p>
      </div>
    </>
  )
}
