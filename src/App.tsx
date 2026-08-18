import { Suspense, lazy, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import GraphView from './components/GraphView'
import type { GraphView3DHandle } from './components/GraphView3D'
import NodeDetailPanel from './components/NodeDetailPanel'
import Toolbar from './components/Toolbar'
import FlowBanner from './components/FlowBanner'
import { getNode } from './data/architecture'
import { useTheme } from './lib/theme'
import { useFlowPlayback } from './lib/useFlowPlayback'
import './App.css'

// The 3D scene is a whole second renderer and most visitors never leave 2D, so
// it is only fetched once the 3D toggle is actually used.
const GraphView3D = lazy(() => import('./components/GraphView3D'))

export type ViewMode = '2d' | '3d'

export default function App() {
  const [theme, setTheme] = useTheme()
  const [viewMode, setViewMode] = useState<ViewMode>('2d')
  const [currentParentId, setCurrentParentId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
  const exportTargetRef = useRef<HTMLDivElement | null>(null)
  const graph3DRef = useRef<GraphView3DHandle | null>(null)
  const flow = useFlowPlayback()

  function focus(nodeId: string) {
    setSelectedNodeId(nodeId)
    setHighlightedNodeId(nodeId)
  }

  function handleSelectNode(nodeId: string) {
    const node = getNode(nodeId)
    if (!node) return
    // If the node lives in a different view than the one currently open
    // (e.g. jumped to via search), switch to that view first.
    const targetParent = node.parentId ?? null
    if (targetParent !== currentParentId) {
      setCurrentParentId(targetParent)
    }
    focus(nodeId)
  }

  function handleDrillInto(nodeId: string) {
    setCurrentParentId(nodeId)
    setSelectedNodeId(null)
    // Flows only cover macro nodes - drilling into a micro view would leave
    // it silently running off-screen.
    if (flow.activeFlowId) flow.stopFlow()
  }

  function handleBackToMacro() {
    setCurrentParentId(null)
    setSelectedNodeId(null)
  }

  function handleStartFlow(id: string) {
    setCurrentParentId(null)
    setSelectedNodeId(null)
    flow.startFlow(id)
  }

  const breadcrumbLabel = currentParentId ? getNode(currentParentId)?.label ?? null : null

  return (
    <div className="app">
      <Toolbar
        breadcrumbLabel={breadcrumbLabel}
        onBackToMacro={handleBackToMacro}
        onJumpTo={handleSelectNode}
        exportTargetRef={exportTargetRef}
        graph3DRef={graph3DRef}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        activeFlowId={flow.activeFlowId}
        onStartFlow={handleStartFlow}
        onStopFlow={flow.stopFlow}
      />
      <div className="app__body">
        {viewMode === '2d' ? (
          <ReactFlowProvider>
            <GraphView
              ref={exportTargetRef}
              currentParentId={currentParentId}
              selectedNodeId={selectedNodeId}
              highlightedNodeId={highlightedNodeId}
              theme={theme}
              flowCurrentNodeId={flow.currentNodeId}
              flowVisitedNodeIds={flow.visitedNodeIds}
              flowVisitedEdgeIds={flow.visitedEdgeIds}
              onSelectNode={handleSelectNode}
              onDrillInto={handleDrillInto}
            />
          </ReactFlowProvider>
        ) : (
          <Suspense fallback={<div className="view-loading">Loading 3D view…</div>}>
            <GraphView3D
              ref={graph3DRef}
              currentParentId={currentParentId}
              selectedNodeId={selectedNodeId}
              highlightedNodeId={highlightedNodeId}
              theme={theme}
              flowCurrentNodeId={flow.currentNodeId}
              flowVisitedNodeIds={flow.visitedNodeIds}
              flowVisitedEdgeIds={flow.visitedEdgeIds}
              onSelectNode={handleSelectNode}
              onDrillInto={handleDrillInto}
            />
          </Suspense>
        )}
        {flow.activeFlowId && (
          <FlowBanner
            label={flow.activeFlowLabel ?? ''}
            note={flow.currentNote}
            stepNumber={flow.stepNumber}
            stepCount={flow.stepCount}
            canGoPrev={!flow.isFirstStep}
            canGoNext={!flow.isLastStep}
            onPrev={flow.prevStep}
            onNext={flow.nextStep}
            onStop={flow.stopFlow}
          />
        )}
        {selectedNodeId && (
          <NodeDetailPanel
            nodeId={selectedNodeId}
            theme={theme}
            onClose={() => setSelectedNodeId(null)}
            onDrillInto={handleDrillInto}
            onSelectNode={handleSelectNode}
          />
        )}
      </div>
    </div>
  )
}
