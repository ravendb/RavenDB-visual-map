import { useEffect, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import GraphView from './components/GraphView'
import NodeDetailPanel from './components/NodeDetailPanel'
import Toolbar from './components/Toolbar'
import FlowPanel from './components/FlowPanel'
import FlowNavBar from './components/FlowNavBar'
import { getChildren, getNode } from './data/architecture'
import { useTheme } from './lib/theme'
import { useFlowPlayback } from './lib/useFlowPlayback'
import { buildUrlHash, parseUrlHash, type MapUrlState } from './lib/urlState'
import './App.css'

export default function App() {
  const [theme, setTheme] = useTheme()
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
  const exportTargetRef = useRef<HTMLDivElement | null>(null)
  const flow = useFlowPlayback()
  // The very first URL-sync pass runs in the same commit as the restore
  // effect below, before its setState calls have taken effect - writing the
  // URL there would flash it back to blank right after a deep link loaded.
  // Skip that one pass; the restore's own state update triggers a real one.
  const skipNextUrlWriteRef = useRef(true)

  function focus(nodeId: string) {
    setSelectedNodeId(nodeId)
    setHighlightedNodeId(nodeId)
  }

  function handleSelectNode(nodeId: string) {
    const node = getNode(nodeId)
    if (!node) return
    // A child only renders once its parent is expanded in place on the map.
    if (node.parentId) setExpandedNodeId(node.parentId)
    focus(nodeId)
  }

  function handleToggleExpand(nodeId: string) {
    setExpandedNodeId((prev) => (prev === nodeId ? null : nodeId))
  }

  function handleBackToMacro() {
    setExpandedNodeId(null)
    setSelectedNodeId(null)
  }

  function handleStartFlow(id: string) {
    setExpandedNodeId(null)
    setSelectedNodeId(null)
    setHighlightedNodeId(null)
    flow.startFlow(id)
  }

  // Reopens whatever a node-based deep link points at: a child node expands
  // its parent and gets selected inside it; a macro node with children opens
  // showing its subcards, same as clicking it does.
  function openDeepLinkedNode(nodeId: string) {
    const node = getNode(nodeId)
    if (!node) return
    setExpandedNodeId(node.parentId ?? (getChildren(nodeId).length > 0 ? nodeId : null))
    focus(nodeId)
  }

  function applyUrlState(state: MapUrlState) {
    setExpandedNodeId(null)
    setSelectedNodeId(null)
    setHighlightedNodeId(null)
    if (state.flowId) {
      flow.startFlow(state.flowId, Math.max((state.step ?? 1) - 1, 0))
      return
    }
    if (flow.activeFlowId) flow.stopFlow()
    if (state.nodeId) openDeepLinkedNode(state.nodeId)
  }

  useEffect(() => {
    applyUrlState(parseUrlHash(window.location.hash))
    // Restoring from whatever URL the page loaded with is a one-time,
    // mount-only concern - re-running it on every state change would fight
    // the write effect below instead of feeding it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onHashChange() {
      applyUrlState(parseUrlHash(window.location.hash))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (skipNextUrlWriteRef.current) {
      skipNextUrlWriteRef.current = false
      return
    }
    const state: MapUrlState = flow.activeFlowId
      ? { nodeId: null, flowId: flow.activeFlowId, step: flow.stepNumber }
      : { nodeId: selectedNodeId, flowId: null, step: null }
    const hash = buildUrlHash(state)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
  }, [selectedNodeId, flow.activeFlowId, flow.stepNumber])

  const breadcrumbLabel = expandedNodeId ? getNode(expandedNodeId)?.label ?? null : null

  return (
    <div className="app">
      <Toolbar
        breadcrumbLabel={breadcrumbLabel}
        onBackToMacro={handleBackToMacro}
        onJumpTo={handleSelectNode}
        exportTargetRef={exportTargetRef}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        activeFlowId={flow.activeFlowId}
        onStartFlow={handleStartFlow}
        onStopFlow={flow.stopFlow}
      />
      <div className="app__body">
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
        {flow.activeFlowId ? (
          <FlowPanel
            label={flow.activeFlowLabel ?? ''}
            steps={flow.visitedSteps}
            stepNumber={flow.stepNumber}
            stepCount={flow.stepCount}
            onStop={flow.stopFlow}
            theme={theme}
            selectedNodeId={selectedNodeId}
            onCloseSelectedNode={() => setSelectedNodeId(null)}
          />
        ) : (
          selectedNodeId && <NodeDetailPanel nodeId={selectedNodeId} theme={theme} onClose={() => setSelectedNodeId(null)} />
        )}
        {flow.activeFlowId && (
          <FlowNavBar
            canGoPrev={!flow.isFirstStep}
            canGoNext={!flow.isLastStep}
            onPrev={flow.prevStep}
            onNext={flow.nextStep}
          />
        )}
      </div>
    </div>
  )
}
