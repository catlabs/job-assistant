import { useEffect, useRef } from 'react'

type BlockingLoadingOverlayProps = {
  open: boolean
  title: string
  message: string
  hint?: string
  steps?: string[]
  fullScreen?: boolean
  modal?: boolean
}

function BlockingLoadingOverlay({
  open,
  title,
  message,
  hint,
  fullScreen = false,
  modal = false,
}: BlockingLoadingOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (open && modal) {
      overlayRef.current?.focus()
    }
  }, [modal, open])

  if (!open) {
    return null
  }

  return (
    <div
      ref={overlayRef}
      className={`blocking-loading-overlay${fullScreen ? ' blocking-loading-overlay-fullscreen' : ''}`}
      role={modal ? 'dialog' : 'status'}
      aria-live={modal ? undefined : 'polite'}
      aria-atomic="true"
      aria-modal={modal || undefined}
      tabIndex={modal ? -1 : undefined}
    >
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
