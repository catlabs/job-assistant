import { Info } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import TechnicalSignalChips from './TechnicalSignalChips'
import { FinancialSignals, getSignalLabel, getWorkArrangementLabel, Job } from '../lib/jobs'
import {
  buildSecondaryJobMeta,
  getCompensationSummary,
  getWorkArrangementIcon,
  isKnownValue,
  isTextValue,
  stripWorkArrangementFromLocation,
} from '../lib/job-presenters'

type JobDetailViewProps = {
  job: Job
}

type DetailRow = {
  label: string
  value: string
}

function CompensationSummaryBlock({
  financial,
  location,
  country,
}: {
  financial: FinancialSignals
  location: string
  country?: string | null
}) {
  const summary = getCompensationSummary(financial, location, country)
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  if (!summary) {
    return null
  }

  const detailRows: DetailRow[] = [
    { label: 'Source', value: summary.sourceDescription },
    { label: 'Range', value: summary.rangeLabel },
    ...(summary.confidence ? [{ label: 'Confidence', value: summary.confidence }] : []),
    ...(summary.basis ? [{ label: 'Basis', value: summary.basis }] : []),
  ]

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div className="job-detail-compensation-inline" ref={popoverRef}>
      <span className="job-detail-compensation-line">
        <span className="job-detail-compensation-label">Compensation:</span>
        <span className="job-detail-compensation-value">{summary.amount}</span>
        {summary.sourceLabel === 'Estimated' ? (
          <span className="job-detail-compensation-estimated">(estimated)</span>
        ) : null}
        <button
          type="button"
          className="job-detail-compensation-info"
          aria-label="Show compensation details"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((currentValue) => !currentValue)}
        >
          <Info size={14} strokeWidth={2} aria-hidden="true" />
        </button>
      </span>

      {isOpen ? (
        <div
          className="job-detail-compensation-popover"
          role="dialog"
          aria-label="Compensation details"
        >
          <dl className="job-detail-facts job-detail-facts-compact">
            {detailRows.map((row) => (
              <div className="job-detail-fact" key={`compensation-${row.label}`}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  )
}

function SummarySection({ title, content }: { title: string; content?: string | null }) {
  if (!isTextValue(content)) {
    return null
  }

  return (
    <section className="job-detail-subsection">
      <h3 className="profile-section-title">{title}</h3>
      <div className="profile-display-copy">{content}</div>
    </section>
  )
}
function JobDetailView({ job }: JobDetailViewProps) {
  const { criteria } = job
  const basics = criteria.job_basics
  const technical = criteria.technical_signals
  const personal = criteria.personal_life_signals
  const financial = criteria.financial_signals
  const strategic = criteria.strategic_signals
  const quality = criteria.extraction_quality

  const location = stripWorkArrangementFromLocation(
    basics.location_text || job.location || '',
    personal.work_arrangement,
  )
  const criteriaJson = JSON.stringify(criteria, null, 2)
  const description = job.description?.trim() ?? ''

  const qualityRows: DetailRow[] = [
    { label: 'Confidence level', value: getSignalLabel(quality.confidence_level) },
  ]
  const secondaryMeta = buildSecondaryJobMeta(basics)

  return (
    <div className="job-detail-dashboard">
      <div className="job-detail-column job-detail-column-scroll">
        <section className="job-detail-subsection job-detail-subsection-hero">
          <div className="job-detail-hero-header">
            <div className="job-detail-hero-copy">
              <h2 className="job-detail-title">{job.title || basics.title || 'Untitled job'}</h2>
              <div className="job-detail-primary-meta">
                {isTextValue(job.company || basics.company_name) ? (
                  <span>{job.company || basics.company_name}</span>
                ) : null}
                {isTextValue(location) ? (
                  <>
                    {isTextValue(job.company || basics.company_name) ? (
                      <span className="job-detail-meta-separator" aria-hidden="true">
                        •
                      </span>
                    ) : null}
                    <span>{location}</span>
                  </>
                ) : null}
                {isKnownValue(personal.work_arrangement) ? (
                  <>
                    {isTextValue(job.company || basics.company_name) || isTextValue(location) ? (
                      <span className="job-detail-meta-separator" aria-hidden="true">
                        •
                      </span>
                    ) : null}
                    <span className="job-detail-work-arrangement">
                      <span className="job-detail-work-arrangement-icon" aria-hidden="true">
                        {(() => {
                          const WorkArrangementIcon = getWorkArrangementIcon(
                            personal.work_arrangement,
                          )
                          return WorkArrangementIcon ? (
                            <WorkArrangementIcon size={13} strokeWidth={2} />
                          ) : null
                        })()}
                      </span>
                      {getWorkArrangementLabel(personal.work_arrangement)}
                    </span>
                  </>
                ) : null}
              </div>
              {secondaryMeta.length > 0 ? (
                <p className="job-detail-secondary-meta">{secondaryMeta.join(' — ')}</p>
              ) : null}
              <CompensationSummaryBlock
                financial={financial}
                location={location}
                country={basics.country}
              />
              {isTextValue(basics.job_summary) ? (
                <div className="profile-display-copy">{basics.job_summary}</div>
              ) : null}
            </div>
          </div>

          <div className="job-detail-hero-support">
            <div className="job-detail-link-row">
              {job.url ? (
                <a href={job.url} target="_blank" rel="noreferrer">
                  Open posting
                </a>
              ) : null}
            </div>
          </div>
        </section>

        <SummarySection title="Work & lifestyle" content={personal.personal_life_notes} />

        <SummarySection title="Strategic summary" content={strategic.strategic_notes} />
      </div>

      <div className="job-detail-column job-detail-column-right job-detail-column-scroll">
        <section className="job-detail-subsection">
          <h3 className="profile-section-title">Technical signals</h3>
          <TechnicalSignalChips
            skills={technical.skills}
            showLegend
            technicalNotes={technical.technical_notes}
          />
        </section>

        <section className="job-detail-subsection">
          <details className="job-detail-raw-details">
            <summary>Extraction quality</summary>
            <dl className="job-detail-facts">
              {qualityRows.map((row) => (
                <div className="job-detail-fact" key={`quality-${row.label}`}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
            {quality.missing_critical_information.length > 0 ? (
              <div className="job-detail-note-block">
                <p className="job-detail-list-title">Missing information</p>
                <ul className="decision-list">
                  {quality.missing_critical_information.map((item, index) => (
                    <li key={`missing-info-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {isTextValue(quality.ambiguity_notes) ? (
              <div className="job-detail-note-block">
                <p className="job-detail-list-title">Ambiguity notes</p>
                <div className="profile-display-copy">{quality.ambiguity_notes}</div>
              </div>
            ) : null}
          </details>
        </section>

        <section className="job-detail-subsection">
          <details className="job-detail-raw-details">
            <summary>Structured extraction JSON</summary>
            <p className="job-detail-inline-meta">
              This is the exact parsed criteria object returned by the API for this job.
            </p>
            <pre className="job-detail-json-block">
              <code>{criteriaJson}</code>
            </pre>
          </details>
        </section>

        <section className="job-detail-subsection">
          <details className="job-detail-raw-details">
            <summary>Original posting text</summary>
            {description ? (
              <div className="job-description job-detail-raw-copy">{description}</div>
            ) : (
              <p className="muted">No original pasted content available.</p>
            )}
          </details>
        </section>
      </div>
    </div>
  )
}

export default JobDetailView
