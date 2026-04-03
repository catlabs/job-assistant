import { Info, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

type DecisionSignalRowProps = {
  label: string
  value: string | number | boolean | null | undefined
  icon?: ReactNode
  showEvidenceIcon?: boolean
  evidenceContent?: string | null
  evidenceLabel?: string
  rawDescription?: string | null
}

const renderValue = (value: string | number | boolean) => {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  return String(value)
}

function DecisionSignalRow({
  label,
  value,
  icon,
  showEvidenceIcon = false,
  evidenceContent = null,
  evidenceLabel = 'Supporting notes',
  rawDescription = null,
}: DecisionSignalRowProps) {
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const titleId = useId()
  const dialogId = useId()
  const notes = evidenceContent?.trim() ?? ''
  const description = rawDescription?.trim() ?? ''
  const hasEvidence = notes.length > 0 || description.length > 0

  useEffect(() => {
    if (!isEvidenceOpen) {
      return
    }

    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsEvidenceOpen(false)
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )

      if (!focusableElements || focusableElements.length === 0) {
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      triggerRef.current?.focus()
    }
  }, [isEvidenceOpen])

  if (value === null || value === undefined) {
    return null
  }

  const displayValue =
    typeof value === 'string' && value.trim().length === 0 ? null : renderValue(value)

  if (!displayValue) {
    return null
  }

  return (
    <>
      <div className="decision-signal-row">
        <div className="decision-signal-row-label">
          {icon ? <span className="decision-signal-row-leading-icon">{icon}</span> : null}
          <span>{label}</span>
        </div>
        <div className="decision-signal-row-value">
          <span>{displayValue}</span>
          {showEvidenceIcon ? (
            <button
              ref={triggerRef}
              type="button"
              className="decision-signal-row-evidence"
              aria-label={
                hasEvidence ? `Show evidence for ${label}` : `No evidence available for ${label}`
              }
              aria-haspopup="dialog"
              aria-expanded={isEvidenceOpen}
              aria-controls={isEvidenceOpen ? dialogId : undefined}
              title={hasEvidence ? `Show evidence for ${label}` : 'No evidence available'}
              data-tooltip={hasEvidence ? 'View evidence' : 'No evidence available'}
              disabled={!hasEvidence}
              onClick={() => setIsEvidenceOpen(true)}
            >
              <Info size={12} strokeWidth={2} />
            </button>
          ) : null}
        </div>
      </div>
      {isEvidenceOpen ? (
        <div
          className="decision-signal-evidence-modal"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsEvidenceOpen(false)
            }
          }}
        >
          <div
            ref={dialogRef}
            id={dialogId}
            className="decision-signal-evidence-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="decision-signal-evidence-header">
              <div className="decision-signal-evidence-heading">
                <p className="decision-signal-evidence-kicker">Decision evidence</p>
                <h4 id={titleId}>{label}</h4>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="decision-signal-evidence-close"
                aria-label={`Close evidence for ${label}`}
                onClick={() => setIsEvidenceOpen(false)}
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <div className="decision-signal-evidence-body">
              {notes ? (
                <section className="decision-signal-evidence-section">
                  <p className="decision-signal-evidence-section-label">{evidenceLabel}</p>
                  <div className="decision-signal-evidence-copy">{notes}</div>
                </section>
              ) : (
                <section className="decision-signal-evidence-section">
                  <p className="decision-signal-evidence-section-label">Extracted notes</p>
                  <p className="decision-signal-evidence-empty">
                    No section-specific notes were extracted for this signal yet. Full posting text
                    is shown below so you can verify it manually.
                  </p>
                </section>
              )}

              {description ? (
                <section className="decision-signal-evidence-section">
                  <p className="decision-signal-evidence-section-label">Full posting</p>
                  <div className="decision-signal-evidence-copy decision-signal-evidence-description">
                    {description}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default DecisionSignalRow
