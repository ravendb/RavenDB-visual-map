import { Suspense, lazy } from 'react'
import type { ReactElement } from 'react'
import { getNode } from '../data/architecture'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../lib/categoryColors'
import { highlightTerms } from '../lib/highlightTerms'
import type { Theme } from '../lib/theme'

// The syntax highlighter is by far the heaviest dependency here and is only
// needed once a node with a codeRef is actually opened.
const CodePreview = lazy(() => import('./CodePreview'))

interface NodeDetailContentProps {
  nodeId: string
  theme: Theme
}

// Splits a description into text/heading blocks (on blank lines) and fenced
// ```lang code snippets, so a node's prose can include runnable examples
// without the split-on-"\n\n" logic below tearing a blank line inside a
// snippet into two blocks.
const FENCE_RE = /```(\w*)\n([\s\S]*?)```/g
// A short "Java:" / ".NET:" / "Node.js:" line naming the snippet that
// immediately follows it - rendered as a highlighted label instead of prose.
const CODE_LABEL_RE = /^[A-Za-z0-9.#+ ]+:$/

function renderDescriptionBlocks(description: string) {
  const nodes: ReactElement[] = []
  let cursor = 0
  let key = 0
  let match: RegExpExecArray | null
  const fenceRe = new RegExp(FENCE_RE)

  const pushProse = (text: string) => {
    for (const block of text.split('\n\n')) {
      const trimmed = block.trim()
      if (!trimmed) continue
      if (block.startsWith('## ')) {
        nodes.push(
          <h4 key={key++} className="detail-panel__subheading">
            {block.slice(3)}
          </h4>,
        )
      } else if (CODE_LABEL_RE.test(trimmed)) {
        nodes.push(
          <p key={key++} className="detail-panel__code-label">
            {trimmed}
          </p>,
        )
      } else {
        nodes.push(<p key={key++}>{highlightTerms(block)}</p>)
      }
    }
  }

  while ((match = fenceRe.exec(description))) {
    pushProse(description.slice(cursor, match.index))
    const [, lang, code] = match
    nodes.push(
      <pre key={key++} className="detail-panel__code-block">
        {lang && <div className="detail-panel__code-lang">{lang}</div>}
        <code>{code.replace(/\n$/, '')}</code>
      </pre>,
    )
    cursor = fenceRe.lastIndex
  }
  pushProse(description.slice(cursor))

  return nodes
}

export default function NodeDetailContent({ nodeId, theme }: NodeDetailContentProps) {
  const node = getNode(nodeId)
  if (!node) return null

  return (
    <>
      <div className="detail-panel__tag" style={{ background: CATEGORY_COLORS[node.category] }}>
        {CATEGORY_LABELS[node.category]}
      </div>
      <h2>{node.label}</h2>

      <p className="detail-panel__summary">{highlightTerms(node.summary)}</p>
      {node.description && (
        <div className="detail-panel__description">{renderDescriptionBlocks(node.description)}</div>
      )}

      <div className="detail-panel__section detail-panel__references">
        <h3>References</h3>
        <div className="detail-panel__links">
          <p className="detail-panel__ref-line">
            Source:{' '}
            {node.references.source.map((link, i) => {
              const label =
                node.references.source.length === 1
                  ? node.label
                  : link.name.slice(link.name.lastIndexOf('/') + 1)
              return (
                <span key={link.url}>
                  <a className="detail-panel__github-link" href={link.url} target="_blank" rel="noreferrer">
                    {label} on GitHub
                  </a>
                  {i < node.references.source.length - 1 ? ', ' : ''}
                </span>
              )
            })}
          </p>
          {node.references.docs && node.references.docs.length > 0 && (
            <p className="detail-panel__ref-line">
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
    </>
  )
}
