interface FlowBannerProps {
  label: string
  note: string | null
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
  note,
  stepNumber,
  stepCount,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  onStop,
}: FlowBannerProps) {
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
      {note && <p className="flow-banner__note">{note}</p>}
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
