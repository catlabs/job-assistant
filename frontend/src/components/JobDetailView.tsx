import { formatCreatedAt, Job } from '../lib/jobs'
import { getFitBadgeClass, getFitLabel } from '../lib/jobDisplay'

type JobDetailViewProps = {
  job: Job
}

function JobDetailView({ job }: JobDetailViewProps) {
  return (
    <>
      <div className="detail-section">
        <p>
          <strong>Title:</strong> {job.title || 'Untitled job'}
        </p>
        <p>
          <strong>Company:</strong> {job.company || 'Unknown company'}
        </p>
        <p>
          <strong>Location:</strong> {job.location || 'Unknown location'}
        </p>
        <p>
          <strong>URL:</strong>{' '}
          {job.url ? (
            <a href={job.url} target="_blank" rel="noreferrer">
              {job.url}
            </a>
          ) : (
            <span className="muted">Not available</span>
          )}
        </p>
        <p>
          <strong>Source:</strong> {job.source || 'unknown'}
        </p>
        <p>
          <strong>Created:</strong> {formatCreatedAt(job.created_at)}
        </p>
      </div>

      <div className="detail-section">
        <p className="section-heading">
          <strong>Description</strong>
        </p>
        <p className="job-description">{job.description || 'No description available.'}</p>
      </div>

      <div className="detail-section">
        <p className="section-heading">
          <strong>Analysis</strong>
        </p>
        <p>
          <strong>Seniority:</strong> {job.analysis?.seniority || 'Unknown'}
        </p>
        <p>
          <strong>Summary:</strong> {job.analysis?.summary || 'Not available'}
        </p>
        <p>
          <strong>Keywords:</strong>{' '}
          {job.analysis?.keywords && job.analysis.keywords.length > 0
            ? job.analysis.keywords.join(', ')
            : 'None'}
        </p>
        <p>
          <strong>Fit classification:</strong>{' '}
          <span className={getFitBadgeClass(job.analysis?.fit_classification)}>
            {getFitLabel(job.analysis?.fit_classification)}
          </span>
        </p>
        {job.analysis?.fit_rationale && (
          <p>
            <strong>Fit rationale:</strong> {job.analysis.fit_rationale}
          </p>
        )}
        {(job.analysis?.decision?.headline?.trim() ||
          job.analysis?.decision?.detail?.trim() ||
          (job.analysis?.decision?.risk_flags?.length ?? 0) > 0 ||
          (job.analysis?.decision?.clarifying_questions?.length ?? 0) > 0) && (
          <div className="decision-block">
            <p className="decision-heading">Decision</p>
            {job.analysis?.decision?.headline && <p>{job.analysis.decision.headline}</p>}
            {job.analysis?.decision?.detail && <p>{job.analysis.decision.detail}</p>}
            {(job.analysis?.decision?.risk_flags?.length ?? 0) > 0 && (
              <>
                <p className="section-heading">
                  <strong>Risk flags</strong>
                </p>
                <ul className="decision-list">
                  {(job.analysis?.decision?.risk_flags ?? []).map((riskFlag, index) => (
                    <li key={`job-risk-flag-${index}`}>{riskFlag}</li>
                  ))}
                </ul>
              </>
            )}
            {(job.analysis?.decision?.clarifying_questions?.length ?? 0) > 0 && (
              <>
                <p className="section-heading">
                  <strong>Clarifying questions</strong>
                </p>
                <ul className="decision-list">
                  {(job.analysis?.decision?.clarifying_questions ?? []).map((question, index) => (
                    <li key={`job-clarifying-question-${index}`}>{question}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        {job.analysis?.normalized_title && (
          <p>
            <strong>Normalized title:</strong> {job.analysis.normalized_title}
          </p>
        )}
        {job.analysis?.normalized_company && (
          <p>
            <strong>Normalized company:</strong> {job.analysis.normalized_company}
          </p>
        )}
        {job.analysis?.normalized_location && (
          <p>
            <strong>Normalized location:</strong> {job.analysis.normalized_location}
          </p>
        )}
      </div>
    </>
  )
}

export default JobDetailView
