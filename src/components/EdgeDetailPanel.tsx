import { getEdge } from '../data/architecture'
import EdgeDetailContent from './EdgeDetailContent'

interface EdgeDetailPanelProps {
  edgeId: string
  onClose: () => void
  onSelectNode: (id: string) => void
}

export default function EdgeDetailPanel({ edgeId, onClose, onSelectNode }: EdgeDetailPanelProps) {
  const edge = getEdge(edgeId)
  if (!edge) return null

  return (
    <aside className="detail-panel">
      <button className="detail-panel__close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <EdgeDetailContent edge={edge} onSelectNode={onSelectNode} />
    </aside>
  )
}
