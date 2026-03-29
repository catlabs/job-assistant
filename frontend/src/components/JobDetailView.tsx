import type { ReactNode } from 'react'
import { formatCreatedAt, Job } from '../lib/jobs'
import { getFitBadgeClass, getFitLabel } from '../lib/jobDisplay'

type JobDetailViewProps = {
  job: Job
}

type JobListProps = {
  title: string
  items: string[]
  emptyMessage: string
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

type JobFactProps = {
  label: string
  value: ReactNode
}

function JobFact({ label, value }: JobFactProps) {
  return (
    <div className="job-detail-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function JobDetailView({ job }: JobDetailViewProps) {
  const fitClassification = job.analysis?.fit_classification
  const decision = job.analysis?.decision
  const keywords = job.analysis?.keywords ?? []
  const hasDecisionContent =
    Boolean(decision?.headline?.trim()) ||
    Boolean(decision?.detail?.trim()) ||
    (decision?.risk_flags?.length ?? 0) > 0 ||
    (decision?.clarifying_questions?.length ?? 0) > 0
  const description = job.description?.trim() ?? ''

  return (
    <div className="job-detail-dashboard">
      <div className="job-detail-column job-detail-column-scroll">
        <section className="job-detail-subsection job-detail-subsection-hero">
          <div className="job-detail-hero-header">
            <div className="job-detail-hero-copy">
              <p className="job-detail-eyebrow">Saved job</p>
              <h2 className="job-detail-title">{job.title || 'Untitled job'}</h2>
              <p className="job-detail-primary-meta">
                <span>{job.company || 'Unknown company'}</span>
                <span className="job-detail-meta-separator" aria-hidden="true">
                  •
                </span>
                <span>{job.location || 'Unknown location'}</span>
              </p>
            </div>

            <span className={getFitBadgeClass(fitClassification)}>{getFitLabel(fitClassification)}</span>
          </div>

          <div className="job-detail-meta-inline">
            <span className="profile-chip">Seniority: {job.analysis?.seniority || 'Unknown'}</span>
            <span className="profile-chip">Source: {job.source || 'Unknown'}</span>
            <span className="profile-chip">Saved: {formatCreatedAt(job.created_at)}</span>
          </div>

          <div className="job-detail-link-row">
            {job.url ? (
              <a href={job.url} target="_blank" rel="noreferrer">
                Open original posting
              </a>
            ) : (
              <p className="muted">Original posting URL not available.</p>
            )}
          </div>
        </section>

        <section className="job-detail-subsection">
          <h3 className="profile-section-title">Decision view</h3>

          {hasDecisionContent ? (
            <div className="job-detail-stack">
              {decision?.headline?.trim() && <p className="job-detail-decision-headline">{decision.headline}</p>}
              {decision?.detail?.trim() && <div className="profile-display-copy">{decision.detail}</div>}
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
          ) : job.analysis?.fit_rationale?.trim() ? (
            <div className="job-detail-stack">
              <p className="job-detail-decision-headline">No explicit decision summary generated.</p>
              <div className="profile-display-copy">{job.analysis.fit_rationale}</div>
            </div>
          ) : (
            <p className="muted">No decision guidance available yet.</p>
          )}
        </section>

        <section className="job-detail-subsection">
          <h3 className="profile-section-title">Role summary</h3>
          {job.analysis?.summary?.trim() ? (
            <div className="profile-display-copy">{job.analysis.summary}</div>
          ) : (
            <p className="muted">No summary available.</p>
          )}
        </section>

        <section className="job-detail-subsection">
          <h3 className="profile-section-title">Fit rationale</h3>
          {job.analysis?.fit_rationale?.trim() ? (
            <div className="profile-display-copy">{job.analysis.fit_rationale}</div>
          ) : (
            <p className="muted">No fit rationale available.</p>
          )}
        </section>
      </div>

      <div className="job-detail-column job-detail-column-right job-detail-column-scroll">
        <section className="job-detail-subsection">
          <h3 className="profile-section-title">Key signals</h3>
          {keywords.length > 0 ? (
            <div className="profile-chip-list">
              {keywords.map((keyword, index) => (
                <span key={`keyword-${index}`} className="profile-chip">
                  {keyword}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">No keywords extracted.</p>
          )}
        </section>

        <section className="job-detail-subsection">
          <h3 className="profile-section-title">Structured details</h3>
          <dl className="job-detail-facts">
            <JobFact label="Original title" value={job.title || 'Untitled job'} />
            <JobFact label="Original company" value={job.company || 'Unknown company'} />
            <JobFact label="Original location" value={job.location || 'Unknown location'} />
            <JobFact label="Normalized title" value={job.analysis?.normalized_title || 'Not available'} />
            <JobFact label="Normalized company" value={job.analysis?.normalized_company || 'Not available'} />
            <JobFact label="Normalized location" value={job.analysis?.normalized_location || 'Not available'} />
          </dl>
        </section>

        <section className="job-detail-subsection">
          <h3 className="profile-section-title">Source details</h3>
          <dl className="job-detail-facts">
            <JobFact
              label="URL"
              value={
                job.url ? (
                  <a href={job.url} target="_blank" rel="noreferrer">
                    {job.url}
                  </a>
                ) : (
                  'Not available'
                )
              }
            />
            <JobFact label="Source" value={job.source || 'Unknown'} />
            <JobFact label="Saved" value={formatCreatedAt(job.created_at)} />
          </dl>
        </section>

        <section className="job-detail-subsection">
          <h3 className="profile-section-title">Original posting text</h3>
          {description ? (
            <details className="job-detail-raw-details">
              <summary>Show original pasted content</summary>
              <div className="job-description job-detail-raw-copy">{description}</div>
            </details>
          ) : (
            <p className="muted">No original pasted content available.</p>
          )}
        </section>
      </div>
    </div>
  )
}

export default JobDetailView
