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
      </div>
    </div>
  )
}

export default BlockingLoadingOverlay
