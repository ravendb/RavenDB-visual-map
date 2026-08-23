import { useMemo, useState } from 'react'
import { edges } from '../data/architecture'
import { FLOWS, getFlowEdgeId } from '../data/flows'

export interface FlowPlaybackState {
  activeFlowId: string | null
  activeFlowLabel: string | null
  currentNodeId: string | null
  currentNote: string | null
  stepNumber: number
  stepCount: number
  isFirstStep: boolean
  isLastStep: boolean
  visitedNodeIds: Set<string>
  visitedEdgeIds: Set<string>
  /** Every node id the active flow touches at any step, regardless of how far playback has gotten - used to dim everything else on the map. */
  flowNodeIds: Set<string>
  startFlow: (id: string) => void
  stopFlow: () => void
  nextStep: () => void
  prevStep: () => void
}

export function useFlowPlayback(): FlowPlaybackState {
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(0)

  const activeFlow = useMemo(() => FLOWS.find((f) => f.id === activeFlowId) ?? null, [activeFlowId])
  const isLastStep = !activeFlow || stepIndex >= activeFlow.steps.length - 1
  const isFirstStep = stepIndex <= 0

  function startFlow(id: string) {
    setActiveFlowId(id)
    setStepIndex(0)
  }

  function stopFlow() {
    setActiveFlowId(null)
  }

  function nextStep() {
    setStepIndex((i) => (activeFlow ? Math.min(i + 1, activeFlow.steps.length - 1) : i))
  }

  function prevStep() {
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  const visitedNodeIds = useMemo(() => {
    if (!activeFlow) return new Set<string>()
    return new Set(activeFlow.steps.slice(0, stepIndex + 1).map((s) => s.nodeId))
  }, [activeFlow, stepIndex])

  const visitedEdgeIds = useMemo(() => {
    if (!activeFlow) return new Set<string>()
    const ids = new Set<string>()
    for (let i = 0; i < stepIndex; i++) {
      const edgeId = getFlowEdgeId(activeFlow.steps[i].nodeId, activeFlow.steps[i + 1].nodeId, edges)
      if (edgeId) ids.add(edgeId)
    }
    return ids
  }, [activeFlow, stepIndex])

  const flowNodeIds = useMemo(() => {
    if (!activeFlow) return new Set<string>()
    return new Set(activeFlow.steps.map((s) => s.nodeId))
  }, [activeFlow])

  return {
    activeFlowId,
    activeFlowLabel: activeFlow?.label ?? null,
    currentNodeId: activeFlow?.steps[stepIndex]?.nodeId ?? null,
    currentNote: activeFlow?.steps[stepIndex]?.note ?? null,
    stepNumber: stepIndex + 1,
    stepCount: activeFlow?.steps.length ?? 0,
    isFirstStep,
    isLastStep,
    visitedNodeIds,
    visitedEdgeIds,
    flowNodeIds,
    startFlow,
    stopFlow,
    nextStep,
    prevStep,
  }
}
