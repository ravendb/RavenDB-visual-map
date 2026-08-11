import { useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import GraphView from './components/GraphView'
import NodeDetailPanel from './components/NodeDetailPanel'
import Toolbar from './components/Toolbar'
import { getNode } from './data/architecture'
import './App.css'

export default function App() {
  const [currentParentId, setCurrentParentId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
  const exportTargetRef = useRef<HTMLDivElement | null>(null)

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
  }

  function handleBackToMacro() {
    setCurrentParentId(null)
    setSelectedNodeId(null)
  }

  const breadcrumbLabel = currentParentId ? getNode(currentParentId)?.label ?? null : null

  return (
    <div className="app">
      <Toolbar
        breadcrumbLabel={breadcrumbLabel}
        onBackToMacro={handleBackToMacro}
        onJumpTo={handleSelectNode}
        exportTargetRef={exportTargetRef}
      />
      <div className="app__body">
        <ReactFlowProvider>
          <GraphView
            ref={exportTargetRef}
            currentParentId={currentParentId}
            selectedNodeId={selectedNodeId}
            highlightedNodeId={highlightedNodeId}
            onSelectNode={handleSelectNode}
            onDrillInto={handleDrillInto}
          />
        </ReactFlowProvider>
        {selectedNodeId && (
          <NodeDetailPanel
            nodeId={selectedNodeId}
            onClose={() => setSelectedNodeId(null)}
            onDrillInto={handleDrillInto}
            onSelectNode={handleSelectNode}
          />
        )}
      </div>
    </div>
  )
}
