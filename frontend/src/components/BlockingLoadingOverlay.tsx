import { CSSProperties } from 'react'

type BlockingLoadingOverlayProps = {
  open: boolean
  title: string
  message: string
  hint?: string
  steps?: string[]
}

function BlockingLoadingOverlay({
  open,
  title,
  message,
  hint,
  steps = [],
}: BlockingLoadingOverlayProps) {
  if (!open) {
    return null
  }

  return (
    <div className="blocking-loading-overlay" role="status" aria-live="polite" aria-atomic="true">
      <div className="blocking-loading-card">
        <div className="blocking-loading-spinner" aria-hidden="true" />
        <div className="blocking-loading-copy">
          <h3>{title}</h3>
          <p>{message}</p>
          {hint ? <p className="blocking-loading-hint">{hint}</p> : null}
        </div>
        {steps.length > 0 ? (
          <ul className="blocking-loading-steps" aria-label="Processing steps">
            {steps.map((step, index) => (
              <li
                key={step}
                className="blocking-loading-step"
                style={{ ['--step-index' as string]: index } as CSSProperties}
              >
                <span className="blocking-loading-step-dot" aria-hidden="true" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

export default BlockingLoadingOverlay
