import { useEffect, useRef } from 'react'
import NodeDetailContent from './NodeDetailContent'
import { highlightTerms } from '../lib/highlightTerms'
import type { Theme } from '../lib/theme'
import type { FlowStepView } from '../lib/useFlowPlayback'

interface FlowPanelProps {
  label: string
  steps: FlowStepView[]
  stepNumber: number
  stepCount: number
  onStop: () => void
  theme: Theme
  selectedNodeId: string | null
  onCloseSelectedNode: () => void
}

export default function FlowPanel({
  label,
  steps,
  stepNumber,
  stepCount,
  onStop,
  theme,
  selectedNodeId,
  onCloseSelectedNode,
}: FlowPanelProps) {
  const currentRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' })
  }, [stepNumber])

  return (
    <aside className="detail-panel flow-panel">
      <button className="detail-panel__close" onClick={onStop} aria-label="Stop flow playback" title="Stop">
        ×
      </button>

      <h2>{label}</h2>
      <p className="flow-panel__step-count">
        Step {stepNumber} / {stepCount}
      </p>

      <ol className="flow-panel__steps">
        {steps.map((step, i) => {
          const isCurrent = i === steps.length - 1
          return (
            <li
              key={`${step.nodeId}-${i}`}
              ref={isCurrent ? currentRef : undefined}
              className={isCurrent ? 'flow-panel__step-row flow-panel__step-row--current' : 'flow-panel__step-row'}
            >
              <span className="flow-panel__step-title">
                {i + 1}. {step.label}
              </span>
              <p className="flow-panel__step-note">{highlightTerms(step.note)}</p>
            </li>
          )
        })}
      </ol>

      {selectedNodeId && (
        <div className="flow-panel__selected-node detail-panel__section">
          <button className="detail-panel__close" onClick={onCloseSelectedNode} aria-label="Close">
            ×
          </button>
          <NodeDetailContent nodeId={selectedNodeId} theme={theme} />
        </div>
      )}
    </aside>
  )
}
