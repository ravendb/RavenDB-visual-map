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
  // The 3D view still drills into a dedicated children-only scene; the 2D view
  // instead expands a node's children in place on the map (see GraphView), so
  // each view mode needs its own idea of "what's currently open".
  const [parentId3D, setParentId3D] = useState<string | null>(null)
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null)
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
    if (viewMode === '3d') {
      // If the node lives in a different scene than the one currently open
      // (e.g. jumped to via search), switch to that scene first.
      const targetParent = node.parentId ?? null
      if (targetParent !== parentId3D) setParentId3D(targetParent)
    } else if (node.parentId) {
      // A child only renders once its parent is expanded in place on the map.
      setExpandedNodeId(node.parentId)
    }
    focus(nodeId)
  }

  function handleToggleExpand(nodeId: string) {
    // Flows only cover macro nodes and macro-level edges, and compete visually
    // with the expand/dim treatment, so opening or closing either kind of
    // drill-down stops whatever flow was playing.
    if (flow.activeFlowId) flow.stopFlow()
    if (viewMode === '3d') {
      setParentId3D(nodeId)
      setSelectedNodeId(null)
      return
    }
    setExpandedNodeId((prev) => (prev === nodeId ? null : nodeId))
  }

  function handleBackToMacro() {
    if (viewMode === '3d') setParentId3D(null)
    else setExpandedNodeId(null)
    setSelectedNodeId(null)
  }

  function handleStartFlow(id: string) {
    setParentId3D(null)
    setExpandedNodeId(null)
    setSelectedNodeId(null)
    flow.startFlow(id)
  }

  const breadcrumbLabel =
    viewMode === '3d' ? (parentId3D ? getNode(parentId3D)?.label ?? null : null) : expandedNodeId ? getNode(expandedNodeId)?.label ?? null : null

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
              expandedNodeId={expandedNodeId}
              selectedNodeId={selectedNodeId}
              highlightedNodeId={highlightedNodeId}
              theme={theme}
              flowCurrentNodeId={flow.currentNodeId}
              flowVisitedNodeIds={flow.visitedNodeIds}
              flowVisitedEdgeIds={flow.visitedEdgeIds}
              flowNodeIds={flow.flowNodeIds}
              onSelectNode={handleSelectNode}
              onToggleExpand={handleToggleExpand}
            />
          </ReactFlowProvider>
        ) : (
          <Suspense fallback={<div className="view-loading">Loading 3D view…</div>}>
            <GraphView3D
              ref={graph3DRef}
              currentParentId={parentId3D}
              selectedNodeId={selectedNodeId}
              highlightedNodeId={highlightedNodeId}
              theme={theme}
              flowCurrentNodeId={flow.currentNodeId}
              flowVisitedNodeIds={flow.visitedNodeIds}
              flowVisitedEdgeIds={flow.visitedEdgeIds}
              flowNodeIds={flow.flowNodeIds}
              onSelectNode={handleSelectNode}
              onDrillInto={handleToggleExpand}
            />
          </Suspense>
        )}
        {flow.activeFlowId && (
          <FlowBanner
            label={flow.activeFlowLabel ?? ''}
            steps={flow.visitedSteps}
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
            isExpanded={viewMode === '2d' ? expandedNodeId === selectedNodeId : parentId3D === selectedNodeId}
            onClose={() => setSelectedNodeId(null)}
            onDrillInto={handleToggleExpand}
            onSelectNode={handleSelectNode}
          />
        )}
      </div>
    </div>
  )
}
