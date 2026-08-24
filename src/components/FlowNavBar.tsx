interface FlowNavBarProps {
  canGoPrev: boolean
  canGoNext: boolean
  onPrev: () => void
  onNext: () => void
}

export default function FlowNavBar({ canGoPrev, canGoNext, onPrev, onNext }: FlowNavBarProps) {
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
