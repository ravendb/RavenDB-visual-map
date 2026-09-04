interface FlowNavBarProps {
  canGoPrev: boolean
  canGoNext: boolean
  isLastStep: boolean
  onPrev: () => void
  onNext: () => void
  onFinish: () => void
}

export default function FlowNavBar({ canGoPrev, canGoNext, isLastStep, onPrev, onNext, onFinish }: FlowNavBarProps) {
  if (isLastStep) {
    return (
      <div className="flow-nav-bar">
        <button className="flow-nav-bar__finish" onClick={onFinish}>
          Koniec
        </button>
      </div>
    )
  }

  return (
    <div className="flow-nav-bar">
      <button onClick={onPrev} disabled={!canGoPrev}>
        ← Previous
      </button>
      <button onClick={onNext} disabled={!canGoNext}>
        Next →
      </button>
    </div>
  )
}
