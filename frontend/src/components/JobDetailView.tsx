import type { ReactNode } from 'react'
import Badge from './Badge'
import FitBadge from './FitBadge'
import {
  getFinancialFitDisplay,
  getLifestyleFitDisplay,
  getStrategicFitDisplay,
} from '../lib/badges'
import { formatCreatedAt, getWorkArrangementLabel, getWorkScheduleSummary, Job } from '../lib/jobs'

type JobDetailViewProps = {
  job: Job
}

type JobListProps = {
  title: string
  items: string[]
  emptyMessage: string
}

type JobFactProps = {
  label: string
  value: ReactNode
}

type DecisionMetricProps = {
  label: string
  value: string
  tone: 'neutral' | 'subtle' | 'danger' | 'fit-strong' | 'fit-acceptable' | 'fit-misaligned'
}

function JobList({ title, items, emptyMessage }: JobListProps) {
  return (
    <div className="job-detail-list-block">
      <h4 className="job-detail-list-title">{title}</h4>
      {items.length > 0 ? (
        <ul className="decision-list">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">{emptyMessage}</p>
      )}
    </div>
  )
}

function JobFact({ label, value }: JobFactProps) {
  return (
    <div className="job-detail-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function DecisionMetric({ label, value, tone }: DecisionMetricProps) {
  return (
    <div className="job-detail-dimension-card">
      <span className="job-detail-signal-label">{label}</span>
      <Badge tone={tone} className="job-detail-dimension-badge">
        {value}
      </Badge>
    </div>
  )
}

const normalizeForCompare = (value?: string | null) => value?.trim().toLowerCase() ?? ''
const trimToNull = (value?: string | null) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
const cleanList = (items?: string[] | null) =>
  (items ?? []).map((item) => item.trim()).filter(Boolean)

const isDistinctCopy = (value?: string | null, against: Array<string | null | undefined> = []) => {
  const normalizedValue = normalizeForCompare(value)
  if (!normalizedValue) {
    return false
  }

  return against.every((item) => normalizeForCompare(item) !== normalizedValue)
}

function JobDetailView({ job }: JobDetailViewProps) {
  const analysis = job.analysis
  const fitClassification = analysis?.fit_classification
  const decision = analysis?.decision
  const dimensionAssessment = analysis?.dimension_assessment
  const decisionV2 = analysis?.decision_v2
  const keywords = analysis?.keywords ?? []
  const workArrangement = analysis?.work_arrangement ?? 'unknown'
  const workArrangementLabel = getWorkArrangementLabel(workArrangement)
  const workScheduleSummary = getWorkScheduleSummary(analysis)
  const workScheduleDetail = trimToNull(analysis?.work_schedule_detail)
  const compensationDisplay = analysis?.compensation_display?.trim()
  const compensationFallback = decisionV2?.compensation_assessment.summary?.trim()
  const compensationLine = compensationDisplay || compensationFallback || 'Not specified'
  const description = job.description?.trim() ?? ''
  const normalizedTitle = analysis?.normalized_title?.trim()
  const normalizedCompany = analysis?.normalized_company?.trim()
  const rawLocation = trimToNull(job.location)
  const normalizedLocation = trimToNull(analysis?.normalized_location)
  const resolvedLocation = normalizedLocation || rawLocation || 'Unknown location'
  const summary = analysis?.summary?.trim()
  const fitRationale = analysis?.fit_rationale?.trim()
  const strategicFitDisplay = getStrategicFitDisplay(dimensionAssessment?.strategic_fit)
  const financialFitDisplay = getFinancialFitDisplay(dimensionAssessment?.financial_fit)
  const lifestyleFitDisplay = getLifestyleFitDisplay(dimensionAssessment?.lifestyle_fit)
  const keyDrivers = cleanList(dimensionAssessment?.key_drivers)
  const keyTradeoffs = cleanList(dimensionAssessment?.key_tradeoffs)
  const keyUnknowns = cleanList(dimensionAssessment?.key_unknowns)
  const hasWorkLocationSignals =
    Boolean(normalizedLocation || rawLocation) ||
    workArrangement !== 'unknown' ||
    Boolean(workScheduleSummary) ||
    Boolean(workScheduleDetail)
  const hasDecisionContent =
    Boolean(decision?.headline?.trim()) ||
    Boolean(decision?.detail?.trim()) ||
    (decision?.risk_flags?.length ?? 0) > 0 ||
    (decision?.clarifying_questions?.length ?? 0) > 0
  const hasStrategicContent =
    Boolean(decisionV2?.career_positioning.narrative?.trim()) ||
    Boolean(decisionV2?.tradeoffs?.length) ||
    Boolean(decisionV2?.career_positioning.positioning_tags?.length) ||
    Boolean(decisionV2?.compensation_assessment.caveats?.trim())
  const hasDecisionBreakdown =
    Boolean(dimensionAssessment?.strategic_fit) ||
    Boolean(dimensionAssessment?.financial_fit) ||
    Boolean(dimensionAssessment?.lifestyle_fit) ||
    keyDrivers.length > 0 ||
    keyTradeoffs.length > 0 ||
    keyUnknowns.length > 0
  const hasSupportingContext =
    isDistinctCopy(summary, [decision?.detail, decision?.headline]) ||
    isDistinctCopy(fitRationale, [decision?.detail, summary, decision?.headline]) ||
    Boolean(normalizedTitle && normalizeForCompare(normalizedTitle) !== normalizeForCompare(job.title)) ||
    Boolean(normalizedCompany && normalizeForCompare(normalizedCompany) !== normalizeForCompare(job.company)) ||
    Boolean(normalizedLocation && normalizeForCompare(normalizedLocation) !== normalizeForCompare(job.location))

  return (
    <div className="job-detail-dashboard">
      <div className="job-detail-column job-detail-column-scroll">
        <section className="job-detail-subsection job-detail-subsection-hero">
          <div className="job-detail-hero-header">
            <div className="job-detail-hero-copy">
              <h2 className="job-detail-title">{job.title || 'Untitled job'}</h2>

              <div className="job-detail-primary-meta">
                <span>{job.company || 'Unknown company'}</span>
                {workArrangement !== 'unknown' ? (
                  <>
                    <span className="job-detail-meta-separator" aria-hidden="true">
                      •
                    </span>
                    <Badge tone="subtle" className="job-detail-inline-badge">
                      {workArrangementLabel}
                    </Badge>
                  </>
                ) : null}
                {resolvedLocation !== 'Unknown location' ? (
                  <>
                    <span className="job-detail-meta-separator" aria-hidden="true">
                      •
                    </span>
                    <span>{resolvedLocation}</span>
                  </>
                ) : null}
              </div>

              <div className="job-detail-compensation-row">
                <span className="job-detail-compensation-label">Compensation</span>
                <p className="job-detail-compensation-value">{compensationLine}</p>
              </div>
            </div>

            <FitBadge fitClassification={fitClassification} className="job-detail-fit-badge" />
          </div>

          <div className="job-detail-hero-support">
            <div className="badge-list job-detail-meta-inline">
              <Badge tone="subtle">Seniority: {analysis?.seniority || 'Unknown'}</Badge>
              <Badge tone="subtle">Source: {job.source || 'Unknown'}</Badge>
              <Badge tone="subtle">Saved: {formatCreatedAt(job.created_at)}</Badge>
            </div>

            <div className="job-detail-link-row">
              {job.url ? (
                <a href={job.url} target="_blank" rel="noreferrer">
                  Open posting
                </a>
              ) : (
                <p className="muted">Original posting URL not available.</p>
              )}
            </div>
          </div>
        </section>

        {hasWorkLocationSignals ? (
          <section className="job-detail-subsection">
            <h3 className="profile-section-title">Work location</h3>
            <div className="job-detail-work-grid">
              {resolvedLocation !== 'Unknown location' ? (
                <div className="job-detail-signal-card">
                  <span className="job-detail-signal-label">Location</span>
                  <p className="job-detail-signal-value">{resolvedLocation}</p>
                </div>
              ) : null}

              {workArrangement !== 'unknown' ? (
                <div className="job-detail-signal-card">
                  <span className="job-detail-signal-label">Arrangement</span>
                  <p className="job-detail-signal-value">{workArrangementLabel}</p>
                </div>
              ) : null}

              {workScheduleSummary ? (
                <div className="job-detail-signal-card">
                  <span className="job-detail-signal-label">Schedule</span>
                  <p className="job-detail-signal-value">{workScheduleSummary}</p>
                </div>
              ) : null}

              {workScheduleDetail ? (
                <div className="job-detail-signal-card">
                  <span className="job-detail-signal-label">Detail</span>
                  <div className="profile-display-copy">{workScheduleDetail}</div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="job-detail-subsection">
          <h3 className="profile-section-title">Decision summary</h3>

          {hasDecisionContent ? (
            <div className="job-detail-stack">
              {decision?.headline?.trim() ? <p className="job-detail-decision-headline">{decision.headline}</p> : null}
              {decision?.detail?.trim() ? <div className="profile-display-copy">{decision.detail}</div> : null}
              {!decision?.detail?.trim() && isDistinctCopy(fitRationale, [decision?.headline]) ? (
                <div className="profile-display-copy">{fitRationale}</div>
              ) : null}
            </div>
          ) : isDistinctCopy(fitRationale) ? (
            <div className="job-detail-stack">
              <p className="job-detail-decision-headline">No explicit decision summary generated.</p>
              <div className="profile-display-copy">{fitRationale}</div>
            </div>
          ) : (
            <p className="muted">No decision guidance available yet.</p>
          )}
        </section>

        {hasDecisionBreakdown ? (
          <section className="job-detail-subsection">
            <h3 className="profile-section-title">Decision breakdown</h3>
            <div className="job-detail-stack">
              <div className="job-detail-dimension-grid">
                <DecisionMetric label="Strategic fit" value={strategicFitDisplay.label} tone={strategicFitDisplay.tone} />
                <DecisionMetric label="Financial fit" value={financialFitDisplay.label} tone={financialFitDisplay.tone} />
                <DecisionMetric label="Lifestyle fit" value={lifestyleFitDisplay.label} tone={lifestyleFitDisplay.tone} />
              </div>

              {keyDrivers.length > 0 ? (
                <JobList title="Why this looks good" items={keyDrivers} emptyMessage="" />
              ) : null}

              {keyTradeoffs.length > 0 ? (
                <JobList title="Tradeoffs" items={keyTradeoffs} emptyMessage="" />
              ) : null}

              {keyUnknowns.length > 0 ? (
                <JobList title="Missing information" items={keyUnknowns} emptyMessage="" />
              ) : null}
            </div>
          </section>
        ) : null}

        {(hasStrategicContent || decisionV2) && (
          <section className="job-detail-subsection">
            <h3 className="profile-section-title">Strategic view</h3>
            <div className="job-detail-stack">
              <div className="job-detail-signal-card">
                <span className="job-detail-signal-label">Pay signal</span>
                <p className="job-detail-signal-value">{compensationLine}</p>
                {decisionV2 ? (
                  <p className="job-detail-inline-meta">
                    {decisionV2.compensation_assessment.clarity === 'clear'
                      ? 'Compensation is clearly stated.'
                      : decisionV2.compensation_assessment.clarity === 'partial'
                        ? 'Compensation is only partially specified.'
                        : 'Compensation is not clearly stated.'}
                    {' '}
                    {decisionV2.compensation_assessment.vs_user_baseline === 'above'
                      ? 'Looks above your baseline.'
                      : decisionV2.compensation_assessment.vs_user_baseline === 'below'
                        ? 'Looks below your baseline.'
                        : decisionV2.compensation_assessment.vs_user_baseline === 'in_line'
                          ? 'Looks broadly in line with your baseline.'
                          : 'Baseline comparison is uncertain.'}
                  </p>
                ) : null}
                {decisionV2?.compensation_assessment.caveats?.trim() ? (
                  <div className="profile-display-copy">{decisionV2.compensation_assessment.caveats}</div>
                ) : null}
              </div>

              {decisionV2?.tradeoffs?.length ? (
                <JobList title="Tradeoffs" items={decisionV2.tradeoffs} emptyMessage="No tradeoffs captured." />
              ) : null}

              {decisionV2?.career_positioning.narrative?.trim() ? (
                <div className="job-detail-signal-card">
                  <span className="job-detail-signal-label">Career positioning</span>
                  <div className="profile-display-copy">{decisionV2.career_positioning.narrative}</div>
                </div>
              ) : null}

              {decisionV2?.career_positioning.positioning_tags?.length ? (
                <div className="job-detail-list-block">
                  <h4 className="job-detail-list-title">Positioning tags</h4>
                  <div className="badge-list">
                    {decisionV2.career_positioning.positioning_tags.map((tag, index) => (
                      <Badge key={`positioning-tag-${index}`} tone="subtle">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {decisionV2 ? <p className="job-detail-inline-meta">Confidence: {decisionV2.confidence}</p> : null}
            </div>
          </section>
        )}

        {(decision?.risk_flags?.length || decision?.clarifying_questions?.length) && (
          <section className="job-detail-subsection">
            <h3 className="profile-section-title">Risks and questions</h3>
            <div className="job-detail-stack">
              <JobList
                title="Risk flags"
                items={decision?.risk_flags ?? []}
                emptyMessage="No risk flags called out."
              />
              <JobList
                title="Clarifying questions"
                items={decision?.clarifying_questions ?? []}
                emptyMessage="No clarifying questions suggested."
              />
            </div>
          </section>
        )}

        {hasSupportingContext ? (
          <section className="job-detail-subsection">
            <details className="job-detail-raw-details">
              <summary>Supporting context</summary>
              <div className="job-detail-stack">
                {isDistinctCopy(summary, [decision?.detail, decision?.headline]) ? (
                  <div className="job-detail-list-block">
                    <h4 className="job-detail-list-title">Role summary</h4>
                    <div className="profile-display-copy">{summary}</div>
                  </div>
                ) : null}

                {isDistinctCopy(fitRationale, [decision?.detail, summary, decision?.headline]) ? (
                  <div className="job-detail-list-block">
                    <h4 className="job-detail-list-title">Fit rationale</h4>
                    <div className="profile-display-copy">{fitRationale}</div>
                  </div>
                ) : null}

                <dl className="job-detail-facts">
                  {normalizedTitle && normalizeForCompare(normalizedTitle) !== normalizeForCompare(job.title) ? (
                    <JobFact label="Normalized title" value={normalizedTitle} />
                  ) : null}
                  {normalizedCompany && normalizeForCompare(normalizedCompany) !== normalizeForCompare(job.company) ? (
                    <JobFact label="Normalized company" value={normalizedCompany} />
                  ) : null}
                  {normalizedLocation && normalizeForCompare(normalizedLocation) !== normalizeForCompare(job.location) ? (
                    <JobFact label="Normalized location" value={normalizedLocation} />
                  ) : null}
                </dl>
              </div>
            </details>
          </section>
        ) : null}
      </div>

      <div className="job-detail-column job-detail-column-right job-detail-column-scroll">
        <section className="job-detail-subsection">
          <h3 className="profile-section-title">Key signals</h3>
          {keywords.length > 0 ? (
            <div className="badge-list">
              {keywords.map((keyword, index) => (
                <Badge key={`keyword-${index}`} tone="subtle">
                  {keyword}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="muted">No keywords extracted.</p>
          )}
        </section>

        <section className="job-detail-subsection">
          <details className="job-detail-raw-details">
            <summary>Posting facts</summary>
            <dl className="job-detail-facts">
              {resolvedLocation !== 'Unknown location' ? <JobFact label="Location" value={resolvedLocation} /> : null}
              {workArrangement !== 'unknown' ? <JobFact label="Work arrangement" value={workArrangementLabel} /> : null}
              {workScheduleSummary ? <JobFact label="Schedule" value={workScheduleSummary} /> : null}
              {workScheduleDetail ? <JobFact label="Detail" value={workScheduleDetail} /> : null}
              <JobFact label="Compensation" value={compensationLine} />
              <JobFact label="Source" value={job.source || 'Unknown'} />
              <JobFact label="Saved" value={formatCreatedAt(job.created_at)} />
              {job.url ? (
                <JobFact
                  label="Posting link"
                  value={
                    <a href={job.url} target="_blank" rel="noreferrer">
                      Open posting
                    </a>
                  }
                />
              ) : null}
            </dl>
          </details>
        </section>

        <section className="job-detail-subsection">
          {description ? (
            <details className="job-detail-raw-details">
              <summary>Original posting text</summary>
              <div className="job-description job-detail-raw-copy">{description}</div>
            </details>
          ) : (
            <>
              <h3 className="profile-section-title">Original posting text</h3>
              <p className="muted">No original pasted content available.</p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default JobDetailView
