import { Info } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import DecisionSignalRow from './DecisionSignalRow'
import TechnicalSignalChips from './TechnicalSignalChips'
import {
  FinancialSignals,
  formatBoolean,
  formatEnum,
  getSignalLabel,
  getWorkArrangementLabel,
  Job,
  SignalEvidence,
} from '../lib/jobs'
import {
  buildSecondaryJobMeta,
  formatCompactMoney,
  getCompensationSummary,
  getWorkArrangementIcon,
  isKnownValue,
  isTextValue,
  stripWorkArrangementFromLocation,
} from '../lib/job-presenters'

type JobDetailViewProps = {
  job: Job
  compensationLoading?: boolean
}

type DetailRow = {
  label: string
  value: string
}

type DecisionEvidence = {
  evidenceContent: string | null
  evidenceLabel: string
  rawDescription: string | null
}

function CompensationSummaryBlock({
  financial,
  location,
  country,
  loading = false,
}: {
  financial: FinancialSignals
  location: string
  country?: string | null
  loading?: boolean
}) {
  const summary = getCompensationSummary(financial, location, country)
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  if (!summary && loading) {
    return (
      <div className="job-detail-compensation-loading" role="status" aria-live="polite" aria-atomic="true">
        <span className="job-detail-compensation-spinner" aria-hidden="true" />
        <span className="job-detail-compensation-loading-copy">
          <span className="job-detail-compensation-loading-title">Estimating salary range...</span>
          <span className="job-detail-compensation-loading-text">Based on role, location, and job context.</span>
        </span>
      </div>
    )
  }

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

const formatNumberRange = (
  minimum: number | null,
  maximum: number | null,
  prefix = '',
  suffix = '',
) => {
  if (minimum === null && maximum === null) {
    return null
  }

  const formatBound = (value: number | null) =>
    value === null ? null : `${prefix}${formatCompactMoney(value)}${suffix}`

  const lower = formatBound(minimum)
  const upper = formatBound(maximum)

  if (lower && upper) {
    return `${lower} - ${upper}`
  }

  return lower ?? upper
}

const getCurrencyPrefix = (currency: FinancialSignals['salary_currency']) => {
  if (currency === 'EUR') {
    return 'EUR '
  }
  if (currency === 'USD') {
    return 'USD '
  }
  if (currency === 'GBP') {
    return 'GBP '
  }
  return ''
}

const getSalarySuffix = (period: FinancialSignals['salary_period']) => {
  if (period === 'yearly') {
    return ' / year'
  }
  if (period === 'monthly') {
    return ' / month'
  }
  if (period === 'hourly') {
    return ' / hour'
  }
  if (period === 'daily') {
    return ' / day'
  }
  return ''
}

const buildDecisionEvidence = (
  evidenceList: Array<SignalEvidence | null | undefined>,
  evidenceLabel: string,
  description: string,
): DecisionEvidence => ({
  evidenceContent: formatEvidenceContent(evidenceList),
  evidenceLabel,
  rawDescription: description || null,
})

const formatEvidenceContent = (evidenceList: Array<SignalEvidence | null | undefined>) => {
  const quotes: string[] = []
  const rationales: string[] = []
  const seenQuotes = new Set<string>()
  const seenRationales = new Set<string>()

  for (const evidence of evidenceList) {
    if (!evidence) {
      continue
    }

    for (const quote of evidence.quotes) {
      const trimmedQuote = quote.trim()
      if (!trimmedQuote || seenQuotes.has(trimmedQuote)) {
        continue
      }
      seenQuotes.add(trimmedQuote)
      quotes.push(trimmedQuote)
    }

    const rationale = evidence.rationale?.trim()
    if (rationale && !seenRationales.has(rationale)) {
      seenRationales.add(rationale)
      rationales.push(rationale)
    }
  }

  if (quotes.length === 0 && rationales.length === 0) {
    return null
  }

  const parts = quotes.map((quote, index) => `${index + 1}. ${quote}`)
  if (rationales.length > 0) {
    parts.push(`Rationale: ${rationales.join(' ')}`)
  }

  return parts.join('\n\n---\n\n')
}

function JobDetailView({ job, compensationLoading = false }: JobDetailViewProps) {
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
  const salaryRange = formatNumberRange(
    financial.salary_min,
    financial.salary_max,
    getCurrencyPrefix(financial.salary_currency),
    getSalarySuffix(financial.salary_period),
  )
  const dailyRateRange = formatNumberRange(
    financial.daily_rate_min,
    financial.daily_rate_max,
    getCurrencyPrefix(financial.salary_currency),
    ' / day',
  )
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
                loading={compensationLoading}
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

        <section className="job-detail-subsection">
          <h3 className="profile-section-title">Work &amp; Lifestyle</h3>
          <div className="decision-signal-panel">
            <DecisionSignalRow
              label="Work arrangement"
              value={
                isKnownValue(personal.work_arrangement)
                  ? getWorkArrangementLabel(personal.work_arrangement)
                  : null
              }
              showEvidenceIcon
              {...buildDecisionEvidence(
                [personal.work_arrangement_evidence, personal.personal_life_notes_evidence],
                'Work arrangement evidence',
                description,
              )}
            />
            <DecisionSignalRow
              label="On-site days per week"
              value={personal.onsite_days_per_week}
              showEvidenceIcon
              {...buildDecisionEvidence(
                [personal.onsite_days_per_week_evidence, personal.personal_life_notes_evidence],
                'On-site schedule evidence',
                description,
              )}
            />
            <DecisionSignalRow
              label="Travel required"
              value={formatBoolean(personal.travel_required)}
              showEvidenceIcon
              {...buildDecisionEvidence(
                [personal.travel_required_evidence, personal.travel_percentage_evidence],
                'Travel evidence',
                description,
              )}
            />
            <DecisionSignalRow
              label="Travel percentage"
              value={
                personal.travel_percentage === null ? null : `${personal.travel_percentage}%`
              }
              showEvidenceIcon
              {...buildDecisionEvidence(
                [personal.travel_percentage_evidence, personal.travel_required_evidence],
                'Travel evidence',
                description,
              )}
            />
            <DecisionSignalRow
              label="Relocation required"
              value={formatBoolean(personal.relocation_required)}
              showEvidenceIcon
              {...buildDecisionEvidence(
                [personal.relocation_required_evidence, personal.personal_life_notes_evidence],
                'Relocation evidence',
                description,
              )}
            />
            <DecisionSignalRow
              label="Schedule flexibility"
              value={formatEnum(personal.schedule_flexibility_signal)}
              showEvidenceIcon
              {...buildDecisionEvidence(
                [personal.schedule_flexibility_signal_evidence, personal.personal_life_notes_evidence],
                'Schedule evidence',
                description,
              )}
            />
          </div>
        </section>

        <section className="job-detail-subsection">
          <h3 className="profile-section-title">Financial</h3>
          <div className="decision-signal-panel">
            <DecisionSignalRow
              label="Salary range"
              value={salaryRange}
              showEvidenceIcon
              {...buildDecisionEvidence(
                [
                  financial.salary_min_evidence,
                  financial.salary_max_evidence,
                  financial.salary_currency_evidence,
                  financial.salary_period_evidence,
                  financial.financial_notes_evidence,
                ],
                'Compensation evidence',
                description,
              )}
            />
            <DecisionSignalRow
              label="Daily rate"
              value={dailyRateRange}
              showEvidenceIcon
              {...buildDecisionEvidence(
                [
                  financial.daily_rate_min_evidence,
                  financial.daily_rate_max_evidence,
                  financial.salary_currency_evidence,
                  financial.salary_period_evidence,
                  financial.financial_notes_evidence,
                ],
                'Compensation evidence',
                description,
              )}
            />
            <DecisionSignalRow
              label="Bonus mentioned"
              value={formatBoolean(financial.bonus_mentioned)}
              showEvidenceIcon
              {...buildDecisionEvidence(
                [financial.bonus_mentioned_evidence, financial.financial_notes_evidence],
                'Bonus evidence',
                description,
              )}
            />
            <DecisionSignalRow
              label="Equity mentioned"
              value={formatBoolean(financial.equity_mentioned)}
              showEvidenceIcon
              {...buildDecisionEvidence(
                [financial.equity_mentioned_evidence, financial.financial_notes_evidence],
                'Equity evidence',
                description,
              )}
            />
            <DecisionSignalRow
              label="Financial clarity"
              value={formatEnum(financial.financial_clarity)}
              showEvidenceIcon
              {...buildDecisionEvidence(
                [financial.financial_clarity_evidence, financial.financial_notes_evidence],
                'Financial clarity evidence',
                description,
              )}
            />
          </div>
        </section>

        <section className="job-detail-subsection">
          <h3 className="profile-section-title">Strategic</h3>
          <div className="decision-signal-panel">
            <DecisionSignalRow
              label="AI exposure"
              value={formatEnum(strategic.ai_exposure_signal)}
              showEvidenceIcon
              {...buildDecisionEvidence(
                [strategic.ai_exposure_signal_evidence, strategic.strategic_notes_evidence],
                'AI exposure evidence',
                description,
              )}
            />
            <DecisionSignalRow
              label="Product ownership"
              value={formatEnum(strategic.product_ownership_signal)}
              showEvidenceIcon
              {...buildDecisionEvidence(
                [strategic.product_ownership_signal_evidence, strategic.strategic_notes_evidence],
                'Product ownership evidence',
                description,
              )}
            />
            <DecisionSignalRow
              label="Delivery scope"
              value={formatEnum(strategic.delivery_scope_signal)}
              showEvidenceIcon
              {...buildDecisionEvidence(
                [strategic.delivery_scope_signal_evidence, strategic.strategic_notes_evidence],
                'Delivery scope evidence',
                description,
              )}
            />
            <DecisionSignalRow
              label="Learning potential"
              value={formatEnum(strategic.learning_potential_signal)}
              showEvidenceIcon
              {...buildDecisionEvidence(
                [strategic.learning_potential_signal_evidence, strategic.strategic_notes_evidence],
                'Learning potential evidence',
                description,
              )}
            />
            <DecisionSignalRow
              label="Market value"
              value={formatEnum(strategic.market_value_signal)}
              showEvidenceIcon
              {...buildDecisionEvidence(
                [strategic.market_value_signal_evidence, strategic.strategic_notes_evidence],
                'Market value evidence',
                description,
              )}
            />
            <DecisionSignalRow
              label="Building role"
              value={formatBoolean(strategic.building_role)}
              showEvidenceIcon
              {...buildDecisionEvidence(
                [strategic.building_role_evidence, strategic.strategic_notes_evidence],
                'Building role evidence',
                description,
              )}
            />
            <DecisionSignalRow
              label="Annotation/evaluation only"
              value={formatBoolean(strategic.annotation_or_evaluation_only)}
              showEvidenceIcon
              {...buildDecisionEvidence(
                [
                  strategic.annotation_or_evaluation_only_evidence,
                  strategic.strategic_notes_evidence,
                ],
                'Annotation/evaluation evidence',
                description,
              )}
            />
          </div>
        </section>
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
