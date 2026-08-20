import { useEffect, useState } from 'react'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

// PrismLight + explicit registration instead of the full Prism build: the
// bundled build ships every language Prism supports (hundreds of kB) and this
// preview only ever shows the three below.
SyntaxHighlighter.registerLanguage('csharp', csharp)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('javascript', javascript)
import { fetchFileContent, languageForPath } from '../lib/github'
import { githubBlobUrl, type CodeRef } from '../data/architecture'
import type { Theme } from '../lib/theme'

const CONTEXT_LINES = 6

interface CodePreviewProps {
  codeRef: CodeRef
  theme: Theme
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; snippet: string; startingLineNumber: number; highlightLines: number[] }

export default function CodePreview({ codeRef, theme }: CodePreviewProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    fetchFileContent(codeRef.file)
      .then(({ content }) => {
        if (cancelled) return
        const lines = content.split('\n')
        const start = codeRef.startLine ?? 1
        const end = codeRef.endLine ?? start
        const windowStart = Math.max(1, start - CONTEXT_LINES)
        const windowEnd = Math.min(lines.length, end + CONTEXT_LINES)
        const snippet = lines.slice(windowStart - 1, windowEnd).join('\n')
        const highlightLines = Array.from({ length: end - start + 1 }, (_, i) => start + i)
        setState({ status: 'ready', snippet, startingLineNumber: windowStart, highlightLines })
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ status: 'error', message: err.message })
      })

    return () => {
      cancelled = true
    }
  }, [codeRef.file, codeRef.startLine, codeRef.endLine])

  const githubUrl = githubBlobUrl(codeRef.file, codeRef.startLine, codeRef.endLine)

  if (state.status === 'loading') {
    return <div className="code-preview code-preview--loading">Loading {codeRef.file}…</div>
  }

  if (state.status === 'error') {
    return (
      <div className="code-preview code-preview--error">
        <p>Couldn't load a live preview ({state.message}).</p>
        <a href={githubUrl} target="_blank" rel="noreferrer">
          View {codeRef.file} on GitHub ↗
        </a>
      </div>
    )
  }

  return (
    <div className="code-preview">
      <div className="code-preview__header">
        <span className="code-preview__file">{codeRef.file}</span>
        <a href={githubUrl} target="_blank" rel="noreferrer">
          Open on GitHub ↗
        </a>
      </div>
      <SyntaxHighlighter
        language={languageForPath(codeRef.file)}
        style={theme === 'dark' ? oneDark : oneLight}
        showLineNumbers
        startingLineNumber={state.startingLineNumber}
        wrapLongLines
        lineProps={(lineNumber: number) => {
          const isHighlighted = state.highlightLines.includes(lineNumber)
          return {
            style: isHighlighted
              ? { display: 'block', background: 'rgba(250, 204, 21, 0.35)' }
              : { display: 'block' },
          }
        }}
        customStyle={{ margin: 0, fontSize: 12.5, maxHeight: 320, overflow: 'auto' }}
      >
        {state.snippet}
      </SyntaxHighlighter>
    </div>
  )
}
