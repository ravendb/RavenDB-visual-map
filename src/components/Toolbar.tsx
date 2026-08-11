import { useState, type RefObject } from 'react'
import { toPng, toSvg } from 'html-to-image'
import SearchBox from './SearchBox'

interface ToolbarProps {
  breadcrumbLabel: string | null
  onBackToMacro: () => void
  onJumpTo: (nodeId: string) => void
  exportTargetRef: RefObject<HTMLDivElement | null>
}

function download(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}

export default function Toolbar({ breadcrumbLabel, onBackToMacro, onJumpTo, exportTargetRef }: ToolbarProps) {
  const [exporting, setExporting] = useState<'png' | 'svg' | null>(null)

  async function handleExport(format: 'png' | 'svg') {
    const target = exportTargetRef.current
    if (!target) return
    setExporting(format)
    try {
      // Captures the graph exactly as currently rendered - whatever drill level,
      // pan, zoom, or selection is active right now - never a fixed default view.
      const dataUrl = format === 'png' ? await toPng(target, { pixelRatio: 2 }) : await toSvg(target)
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

      <div className="toolbar__export">
        <button onClick={() => handleExport('png')} disabled={exporting !== null}>
          {exporting === 'png' ? 'Exporting…' : 'Export PNG'}
        </button>
        <button onClick={() => handleExport('svg')} disabled={exporting !== null}>
          {exporting === 'svg' ? 'Exporting…' : 'Export SVG'}
        </button>
      </div>
    </header>
  )
}
