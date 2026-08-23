import { Suspense, lazy } from 'react'
import { getChildren, getNode } from '../data/architecture'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../lib/categoryColors'
import type { Theme } from '../lib/theme'

// The syntax highlighter is by far the heaviest dependency here and is only
// needed once a node with a codeRef is actually opened.
const CodePreview = lazy(() => import('./CodePreview'))

interface NodeDetailPanelProps {
  nodeId: string
  theme: Theme
  /** True while this node's children are currently expanded/drilled into in the graph view. */
  isExpanded: boolean
  onClose: () => void
  onDrillInto: (id: string) => void
  onSelectNode: (id: string) => void
}

export default function NodeDetailPanel({ nodeId, theme, isExpanded, onClose, onDrillInto, onSelectNode }: NodeDetailPanelProps) {
  const node = getNode(nodeId)
  if (!node) return null

  const children = getChildren(node.id)

  return (
    <aside className="detail-panel">
      <button className="detail-panel__close" onClick={onClose} aria-label="Close">
        ×
      </button>

      <div className="detail-panel__tag" style={{ background: CATEGORY_COLORS[node.category] }}>
        {CATEGORY_LABELS[node.category]}
      </div>
      <h2>{node.label}</h2>

      <p className="detail-panel__summary">{node.summary}</p>
      {node.description && <p className="detail-panel__description">{node.description}</p>}

      <div className="detail-panel__section detail-panel__references">
        <h3>References</h3>
        <div className="detail-panel__links">
          {node.references.source.map((link) => {
            const label =
              node.references.source.length === 1
                ? node.label
                : link.name.slice(link.name.lastIndexOf('/') + 1)
            return (
              <a key={link.url} className="detail-panel__github-link" href={link.url} target="_blank" rel="noreferrer">
                Source: {label} on GitHub repository
              </a>
            )
          })}
          {node.references.docs && node.references.docs.length > 0 && (
            <p className="detail-panel__docs-line">
              Docs:{' '}
              {node.references.docs.map((link, i) => (
                <span key={link.url}>
                  <a className="detail-panel__docs-link" href={link.url} target="_blank" rel="noreferrer">
                    {link.name}
                  </a>
                  {i < node.references.docs!.length - 1 ? ', ' : ''}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>

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
            {isExpanded ? 'Collapse on map ↑' : 'Show structure on map ↴'}
          </button>
        </div>
      )}
    </aside>
  )
}
