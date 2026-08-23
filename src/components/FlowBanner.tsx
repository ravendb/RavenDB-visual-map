import { useEffect, useRef } from 'react'
import type { FlowStepView } from '../lib/useFlowPlayback'

interface FlowBannerProps {
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

export default function FlowBanner({
  label,
  steps,
  stepNumber,
  stepCount,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  onStop,
}: FlowBannerProps) {
  const currentRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' })
  }, [stepNumber])

  return (
    <div className="flow-banner">
      <div className="flow-banner__header">
        <span className="flow-banner__label">{label}</span>
        <span className="flow-banner__step">
          Step {stepNumber} / {stepCount}
        </span>
        <button className="flow-banner__stop" onClick={onStop} aria-label="Stop flow playback" title="Stop">
          ✕
        </button>
      </div>
      <ol className="flow-banner__steps">
        {steps.map((step, i) => {
          const isCurrent = i === steps.length - 1
          return (
            <li
              key={`${step.nodeId}-${i}`}
              ref={isCurrent ? currentRef : undefined}
              className={isCurrent ? 'flow-banner__step-row flow-banner__step-row--current' : 'flow-banner__step-row'}
            >
              <span className="flow-banner__step-title">
                {i + 1}. {step.label}
              </span>
              {isCurrent && <p className="flow-banner__step-note">{step.note}</p>}
            </li>
          )
        })}
      </ol>
      <div className="flow-banner__nav">
        <button onClick={onPrev} disabled={!canGoPrev}>
          ← Previous
        </button>
        <button onClick={onNext} disabled={!canGoNext}>
          Next →
        </button>
      </div>
    </div>
  )
}
