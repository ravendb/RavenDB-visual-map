import { useState, type RefObject } from 'react'
import { toPng } from 'html-to-image'
import SearchBox from './SearchBox'
import type { Theme } from '../lib/theme'
import { FLOWS } from '../data/flows'

interface ToolbarProps {
  breadcrumbLabel: string | null
  onBackToMacro: () => void
  onJumpTo: (nodeId: string) => void
  exportTargetRef: RefObject<HTMLDivElement | null>
  theme: Theme
  onToggleTheme: () => void
  activeFlowId: string | null
  onStartFlow: (id: string) => void
  onStopFlow: () => void
}

function download(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}

export default function Toolbar({
  breadcrumbLabel,
  onBackToMacro,
  onJumpTo,
  exportTargetRef,
  theme,
  onToggleTheme,
  activeFlowId,
  onStartFlow,
  onStopFlow,
}: ToolbarProps) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      // Captures the graph exactly as currently rendered - whatever drill level,
      // pan, zoom, or selection is active right now - never a fixed default view.
      const target = exportTargetRef.current
      if (!target) return
      const dataUrl = await toPng(target, { pixelRatio: 2 })
      const stamp = breadcrumbLabel ? breadcrumbLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'overview'
      download(dataUrl, `ravendb-map-${stamp}.png`)
    } catch (err) {
      console.error('Export failed', err)
      window.alert('Export failed - see console for details.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <header className="toolbar">
      <div className="toolbar__brand">RavenDB Architecture Map</div>

      <nav className="toolbar__breadcrumb">
        <button onClick={onBackToMacro} disabled={!breadcrumbLabel}>
          Overview
        </button>
        {breadcrumbLabel && (
          <>
            <span>/</span>
            <span>{breadcrumbLabel}</span>
          </>
        )}
      </nav>

      <SearchBox onJumpTo={onJumpTo} />

      <select
        className="toolbar__flow-picker"
        value={activeFlowId ?? ''}
        onChange={(e) => (e.target.value ? onStartFlow(e.target.value) : onStopFlow())}
        aria-label="View a flow"
        title="Watch how a request flows through the architecture"
      >
        <option value="">Show a flow…</option>
        {FLOWS.map((flow) => (
          <option key={flow.id} value={flow.id}>
            {flow.label}
          </option>
        ))}
      </select>

      <div className="toolbar__export">
        <button
          className="toolbar__theme-toggle"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
        <button onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export PNG'}
        </button>
      </div>
    </header>
  )
}
