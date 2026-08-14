import { useState, type RefObject } from 'react'
import { toPng, toSvg } from 'html-to-image'
import SearchBox from './SearchBox'
import type { Theme } from '../lib/theme'
import type { ViewMode } from '../App'
import type { GraphView3DHandle } from './GraphView3D'
import { FLOWS } from '../data/flows'

interface ToolbarProps {
  breadcrumbLabel: string | null
  onBackToMacro: () => void
  onJumpTo: (nodeId: string) => void
  exportTargetRef: RefObject<HTMLDivElement | null>
  graph3DRef: RefObject<GraphView3DHandle | null>
  theme: Theme
  onToggleTheme: () => void
  viewMode: ViewMode
  onChangeViewMode: (mode: ViewMode) => void
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
  graph3DRef,
  theme,
  onToggleTheme,
  viewMode,
  onChangeViewMode,
  activeFlowId,
  onStartFlow,
  onStopFlow,
}: ToolbarProps) {
  const [exporting, setExporting] = useState<'png' | 'svg' | null>(null)

  async function handleExport(format: 'png' | 'svg') {
    setExporting(format)
    try {
      // Captures the graph exactly as currently rendered - whatever drill level,
      // pan, zoom, or selection is active right now - never a fixed default view.
      let dataUrl: string
      if (viewMode === '3d') {
        const png = await graph3DRef.current?.exportPng()
        if (!png) throw new Error('3D view is not ready yet')
        dataUrl = png
      } else {
        const target = exportTargetRef.current
        if (!target) return
        dataUrl = format === 'png' ? await toPng(target, { pixelRatio: 2 }) : await toSvg(target)
      }
      const stamp = breadcrumbLabel ? breadcrumbLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'overview'
      download(dataUrl, `ravendb-map-${stamp}.${format}`)
    } catch (err) {
      console.error('Export failed', err)
      window.alert('Export failed - see console for details.')
    } finally {
      setExporting(null)
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

      <div className="toolbar__view-toggle" role="group" aria-label="View mode">
        <button className={viewMode === '2d' ? 'is-active' : ''} onClick={() => onChangeViewMode('2d')}>
          2D
        </button>
        <button className={viewMode === '3d' ? 'is-active' : ''} onClick={() => onChangeViewMode('3d')}>
          3D
        </button>
      </div>

      <div className="toolbar__export">
        <button
          className="toolbar__theme-toggle"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
        <button onClick={() => handleExport('png')} disabled={exporting !== null}>
          {exporting === 'png' ? 'Exporting…' : 'Export PNG'}
        </button>
        <button
          onClick={() => handleExport('svg')}
          disabled={exporting !== null || viewMode === '3d'}
          title={viewMode === '3d' ? 'SVG export is not available for the 3D view' : undefined}
        >
          {exporting === 'svg' ? 'Exporting…' : 'Export SVG'}
        </button>
      </div>
    </header>
  )
}
