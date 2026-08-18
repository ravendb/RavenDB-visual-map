import { Suspense, lazy } from 'react'
import { getChildren, getNode, githubBlobUrl, githubTreeUrl } from '../data/architecture'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../lib/categoryColors'
import type { Theme } from '../lib/theme'

// The syntax highlighter is by far the heaviest dependency here and is only
// needed once a node with a codeRef is actually opened.
const CodePreview = lazy(() => import('./CodePreview'))

interface NodeDetailPanelProps {
  nodeId: string
  theme: Theme
  onClose: () => void
  onDrillInto: (id: string) => void
  onSelectNode: (id: string) => void
}

export default function NodeDetailPanel({ nodeId, theme, onClose, onDrillInto, onSelectNode }: NodeDetailPanelProps) {
  const node = getNode(nodeId)
  if (!node) return null

  const children = getChildren(node.id)
  // Not `includes('.')`: almost every folder path here contains a dot
  // ("src/Raven.Server/Documents"), which built a /blob/ URL for a directory.
  const isFile = /\.[a-z0-9]{1,5}$/i.test(node.githubPath)
  const githubUrl = isFile ? githubBlobUrl(node.githubPath) : githubTreeUrl(node.githubPath)

  return (
    <aside className="detail-panel">
      <button className="detail-panel__close" onClick={onClose} aria-label="Close">
        ×
      </button>

      <div className="detail-panel__tag" style={{ background: CATEGORY_COLORS[node.category] }}>
        {CATEGORY_LABELS[node.category]}
      </div>
      <h2>{node.label}</h2>
      {node.needsReview && (
        <p className="detail-panel__review-note">
          First pass, not yet checked by a subsystem expert — treat details here as a starting point.
        </p>
      )}

      <p className="detail-panel__summary">{node.summary}</p>
      {node.description && <p className="detail-panel__description">{node.description}</p>}

      <a className="detail-panel__github-link" href={githubUrl} target="_blank" rel="noreferrer">
        View {node.githubPath} on GitHub ↗
      </a>

      {node.docsUrl && (
        <a className="detail-panel__docs-link" href={node.docsUrl} target="_blank" rel="noreferrer">
          Read the documentation for this area ↗
        </a>
      )}

      {node.codeRef && (
        <div className="detail-panel__section">
          <h3>Code preview</h3>
          <Suspense fallback={<div className="code-preview code-preview--loading">Loading preview…</div>}>
            <CodePreview codeRef={node.codeRef} theme={theme} />
          </Suspense>
        </div>
      )}

      {children.length > 0 && (
        <div className="detail-panel__section">
          <h3>Structure ({children.length})</h3>
          <ul className="detail-panel__children">
            {children.map((child) => (
              <li key={child.id}>
                <button onClick={() => onSelectNode(child.id)}>{child.label}</button>
              </li>
            ))}
          </ul>
          <button className="detail-panel__expand-button" onClick={() => onDrillInto(node.id)}>
            Open micro view ↴
          </button>
        </div>
      )}
    </aside>
  )
}
