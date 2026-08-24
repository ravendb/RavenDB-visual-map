import { getNode } from '../data/architecture'
import NodeDetailContent from './NodeDetailContent'
import type { Theme } from '../lib/theme'

interface NodeDetailPanelProps {
  nodeId: string
  theme: Theme
  onClose: () => void
}

export default function NodeDetailPanel({ nodeId, theme, onClose }: NodeDetailPanelProps) {
  if (!getNode(nodeId)) return null

  return (
    <aside className="detail-panel">
      <button className="detail-panel__close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <NodeDetailContent nodeId={nodeId} theme={theme} />
    </aside>
  )
}
