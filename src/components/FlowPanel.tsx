import { useEffect, useRef } from 'react'
import type { FlowStepView } from '../lib/useFlowPlayback'

interface FlowPanelProps {
  label: string
  steps: FlowStepView[]
  stepNumber: number
  stepCount: number
  canGoPrev: boolean
  canGoNext: boolean
  onPrev: () => void
  onNext: () => void
  onStop: () => void
}

export default function FlowPanel({
  label,
  steps,
  stepNumber,
  stepCount,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  onStop,
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
              {isCurrent && <p className="flow-panel__step-note">{step.note}</p>}
            </li>
          )
        })}
      </ol>

      <div className="flow-panel__nav">
        <button onClick={onPrev} disabled={!canGoPrev}>
          ← Previous
        </button>
        <button onClick={onNext} disabled={!canGoNext}>
          Next →
        </button>
      </div>
    </aside>
  )
}
