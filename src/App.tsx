import { useEffect, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import GraphView from './components/GraphView'
import NodeDetailPanel from './components/NodeDetailPanel'
import EdgeDetailPanel from './components/EdgeDetailPanel'
import Toolbar from './components/Toolbar'
import FlowPanel from './components/FlowPanel'
import FlowNavBar from './components/FlowNavBar'
import FreeformMap from './components/FreeformMap'
import { getNode } from './data/architecture'
import { useTheme } from './lib/theme'
import { useFlowPlayback } from './lib/useFlowPlayback'
import { buildUrlHash, FREEFORM_HASH, isPageHash, parseUrlHash, type MapUrlState } from './lib/urlState'
import './App.css'

export default function App() {
  const [theme, setTheme] = useTheme()
  const [isFreeform, setIsFreeform] = useState(() => window.location.hash === FREEFORM_HASH)
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const exportTargetRef = useRef<HTMLDivElement | null>(null)
  const flow = useFlowPlayback()
  // The very first URL-sync pass runs in the same commit as the restore
  // effect below, before its setState calls have taken effect - writing the
  // URL there would flash it back to blank right after a deep link loaded.
  // Skip that one pass; the restore's own state update triggers a real one.
  const skipNextUrlWriteRef = useRef(true)

  function focus(nodeId: string | null) {
    setSelectedNodeId(nodeId)
    setHighlightedNodeId(nodeId)
  }

  function handleSelectNode(nodeId: string) {
    const node = getNode(nodeId)
    if (!node) return
    setSelectedEdgeId(null)
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
    setSelectedEdgeId(null)
  }

  function handleStartFlow(id: string) {
    setExpandedNodeId(null)
    setSelectedNodeId(null)
    setHighlightedNodeId(null)
    setSelectedEdgeId(null)
    flow.startFlow(id)
  }

  // Mirrors handleSelectNode: picking a different connection (or a node)
  // always replaces whatever else was open, rather than stacking panels.
  function handleSelectEdge(edgeId: string) {
    setExpandedNodeId(null)
    setSelectedNodeId(null)
    setHighlightedNodeId(null)
    setSelectedEdgeId(edgeId)
  }

  function handleDeselectEdge() {
    setSelectedEdgeId(null)
  }

  // Reopens whatever a URL points at. expandedNodeId and nodeId (selection)
  // are restored independently rather than one derived from the other, so a
  // node left collapsed-but-selected (or expanded with nothing selected
  // inside it) comes back exactly as it was left, not re-expanded by default -
  // see urlState.ts's defaultExpandedFor for the one case that still infers it.
  function applyUrlState(state: MapUrlState) {
    setSelectedEdgeId(null)
    focus(state.nodeId)
    if (state.flowId) {
      setExpandedNodeId(null)
      flow.startFlow(state.flowId, Math.max((state.step ?? 1) - 1, 0))
      return
    }
    if (flow.activeFlowId) flow.stopFlow()
    setExpandedNodeId(state.expandedNodeId)
  }

  useEffect(() => {
    if (!isPageHash(window.location.hash)) applyUrlState(parseUrlHash(window.location.hash))
    // Restoring from whatever URL the page loaded with is a one-time,
    // mount-only concern - re-running it on every state change would fight
    // the write effect below instead of feeding it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash
      setIsFreeform(hash === FREEFORM_HASH)
      if (!isPageHash(hash)) applyUrlState(parseUrlHash(hash))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Each step should show its own node's detail, same as clicking that
    // tile would - not whatever was last selected before the flow started.
    if (flow.activeFlowId && flow.currentNodeId) focus(flow.currentNodeId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.activeFlowId, flow.currentNodeId])

  useEffect(() => {
    if (skipNextUrlWriteRef.current) {
      skipNextUrlWriteRef.current = false
      return
    }
    const state: MapUrlState = flow.activeFlowId
      ? { nodeId: selectedNodeId, expandedNodeId: null, flowId: flow.activeFlowId, step: flow.stepNumber }
      : { nodeId: selectedNodeId, expandedNodeId, flowId: null, step: null }
    const hash = buildUrlHash(state)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
  }, [selectedNodeId, expandedNodeId, flow.activeFlowId, flow.stepNumber])

  const breadcrumbLabel = expandedNodeId ? getNode(expandedNodeId)?.label ?? null : null

  if (isFreeform) {
    return <FreeformMap theme={theme} onExit={() => (window.location.hash = '')} />
  }

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
        onOpenFreeform={() => (window.location.hash = FREEFORM_HASH)}
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
            flowHighlightChildId={flow.currentHighlightChildId}
            selectedEdgeId={selectedEdgeId}
            onSelectNode={handleSelectNode}
            onToggleExpand={handleToggleExpand}
            onDeselect={() => setSelectedNodeId(null)}
            onSelectEdge={handleSelectEdge}
            onDeselectEdge={handleDeselectEdge}
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
        ) : selectedEdgeId ? (
          <EdgeDetailPanel edgeId={selectedEdgeId} onClose={handleDeselectEdge} onSelectNode={handleSelectNode} />
        ) : (
          selectedNodeId && <NodeDetailPanel nodeId={selectedNodeId} theme={theme} onClose={() => setSelectedNodeId(null)} />
        )}
        {flow.activeFlowId && (
          <FlowNavBar
            canGoPrev={!flow.isFirstStep}
            canGoNext={!flow.isLastStep}
            isLastStep={flow.isLastStep}
            onPrev={flow.prevStep}
            onNext={flow.nextStep}
            onFinish={flow.stopFlow}
          />
        )}
      </div>
    </div>
  )
}
