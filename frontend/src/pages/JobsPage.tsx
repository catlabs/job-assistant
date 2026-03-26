import { useEffect, useState } from 'react'
import {
  API_BASE_URL,
  formatCreatedAt,
  getApiErrorMessage,
  Job,
  JobAnalysis,
  JobListResponse,
} from '../lib/jobs'

type FitFilter = 'all' | 'strong_fit' | 'acceptable_intermediate' | 'misaligned' | 'unassessed'

const getFitLabel = (fitClassification?: JobAnalysis['fit_classification']) => {
  if (fitClassification === 'strong_fit') {
    return 'Strong fit'
  }
  if (fitClassification === 'acceptable_intermediate') {
    return 'Acceptable / Intermediate'
  }
  if (fitClassification === 'misaligned') {
    return 'Misaligned'
  }
  return 'Unassessed'
}

function JobsPage() {
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobsError, setJobsError] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [fitFilter, setFitFilter] = useState<FitFilter>('all')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [compareSelectedIds, setCompareSelectedIds] = useState<string[]>([])
  const [isComparePanelVisible, setIsComparePanelVisible] = useState(false)
  const [compareHint, setCompareHint] = useState('')

  const fetchJobs = async () => {
    setJobsError('')

    if (!API_BASE_URL) {
      setJobsError('Missing VITE_API_BASE_URL. Add it to frontend/.env.')
      setJobs([])
      return
    }

    setJobsLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/jobs/`)
      const responseBody = await response.json().catch(() => null)

      if (!response.ok) {
        const apiMessage = getApiErrorMessage(responseBody)
        throw new Error(apiMessage || 'Could not load saved jobs.')
      }

      const data = responseBody as JobListResponse
      const nextJobs = Array.isArray(data.jobs) ? data.jobs : []
      setJobs(nextJobs)
      setSelectedJob((currentSelectedJob) => {
        if (!currentSelectedJob) {
          return null
        }

        const refreshedSelectedJob = nextJobs.find(
          (job) => String(job.id) === String(currentSelectedJob.id),
        )
        return refreshedSelectedJob ?? null
      })
      setCompareSelectedIds((currentIds) => {
        const availableIds = new Set(nextJobs.map((job) => String(job.id)))
        const nextIds = currentIds.filter((id) => availableIds.has(id))
        if (nextIds.length < 2) {
          setIsComparePanelVisible(false)
        }
        return nextIds
      })
    } catch (jobsRequestError) {
      if (jobsRequestError instanceof TypeError) {
        setJobsError('Network error while loading jobs. Please check your connection and try again.')
      } else if (jobsRequestError instanceof Error) {
        setJobsError(jobsRequestError.message)
      } else {
        setJobsError('Could not load saved jobs.')
      }
      setJobs([])
      setCompareSelectedIds([])
      setIsComparePanelVisible(false)
      setCompareHint('')
    } finally {
      setJobsLoading(false)
    }
  }

  useEffect(() => {
    void fetchJobs()
  }, [])

  const handleToggleCompareSelection = (jobId: string) => {
    setCompareHint('')
    setCompareSelectedIds((currentIds) => {
      if (currentIds.includes(jobId)) {
        return currentIds.filter((id) => id !== jobId)
      }

      // Keep compare intentionally capped at 2 so the table stays minimal and readable.
      if (currentIds.length >= 2) {
        setCompareHint('Select only 2 jobs to compare.')
        return currentIds
      }

      return [...currentIds, jobId]
    })
    setIsComparePanelVisible(false)
  }

  const filteredJobs = jobs.filter((job) => {
    const fitClassification = job.analysis?.fit_classification
    if (fitFilter === 'all') {
      return true
    }
    if (fitFilter === 'unassessed') {
      return !fitClassification
    }
    return fitClassification === fitFilter
  })

  const comparedJobs = compareSelectedIds
    .map((id) => filteredJobs.find((job) => String(job.id) === id))
    .filter((job): job is Job => Boolean(job))

  const canCompare = comparedJobs.length === 2
  const shouldShowComparePanel = isComparePanelVisible && canCompare
  const handleClearComparison = () => {
    setCompareSelectedIds([])
    setIsComparePanelVisible(false)
    setCompareHint('')
  }

  return (
    <>
      <h1>Saved Jobs</h1>
      <p>Browse saved jobs, open details, and compare two jobs side by side.</p>

      <section className="panel">
        {jobsLoading && <p>Loading saved jobs…</p>}
        {jobsError && <p className="error">{jobsError}</p>}
        {!jobsLoading && !jobsError && jobs.length === 0 && <p className="muted">No saved jobs yet.</p>}
        {!jobsLoading && !jobsError && jobs.length > 0 && (
          <>
            <div className="jobs-list-header">
              <label className="fit-filter-control">
                Fit filter
                <select
                  value={fitFilter}
                  onChange={(event) => {
                    setFitFilter(event.target.value as FitFilter)
                    setCompareSelectedIds([])
                    setIsComparePanelVisible(false)
                    setCompareHint('')
                  }}
                >
                  <option value="all">All</option>
                  <option value="strong_fit">Strong fit</option>
                  <option value="acceptable_intermediate">Acceptable / Intermediate</option>
                  <option value="misaligned">Misaligned</option>
                  <option value="unassessed">Unassessed</option>
                </select>
              </label>
              <button
                type="button"
                className="secondary-button"
                disabled={!canCompare}
                onClick={() => setIsComparePanelVisible(true)}
              >
                Compare selected
              </button>
            </div>
            {compareHint && <p className="muted compare-hint">{compareHint}</p>}
            {filteredJobs.length === 0 && <p className="muted">No jobs match this fit filter.</p>}
            <ul className="jobs-list">
              {filteredJobs.map((job) => {
                const jobId = String(job.id)
                const isSelected = selectedJob ? String(selectedJob.id) === jobId : false
                const isCompared = compareSelectedIds.includes(jobId)
                const fitClassification = job.analysis?.fit_classification
                return (
                  <li
                    key={job.id}
                    className={`job-item ${isSelected ? 'job-item-selected' : ''}`}
                    onClick={() => setSelectedJob(job)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedJob(job)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="job-item-checkbox">
                      <input
                        type="checkbox"
                        checked={isCompared}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          event.stopPropagation()
                          handleToggleCompareSelection(jobId)
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                        aria-label={`Compare ${job.title || `job ${job.id}`}`}
                      />
                    </div>
                    <div>
                      <p>
                        <strong>{job.title || 'Untitled job'}</strong>
                        {fitClassification && (
                          <span className="fit-badge">{getFitLabel(fitClassification)}</span>
                        )}
                      </p>
                      <p>{job.company || 'Unknown company'}</p>
                      <p>{job.location || 'Unknown location'}</p>
                      <p className="muted">Source: {job.source || 'unknown'} | ID: {job.id}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
        {!jobsLoading && !jobsError && shouldShowComparePanel && comparedJobs.length === 2 && (
          <section className="panel">
            <div className="job-detail-header">
              <h3>Job comparison</h3>
              <button type="button" className="secondary-button" onClick={handleClearComparison}>
                Clear comparison
              </button>
            </div>
            <table className="compare-table">
              <tbody>
                <tr>
                  <th scope="row">Field</th>
                  <th>{comparedJobs[0].title || 'Untitled job'}</th>
                  <th>{comparedJobs[1].title || 'Untitled job'}</th>
                </tr>
                <tr>
                  <th scope="row">Title</th>
                  <td>{comparedJobs[0].title || 'Untitled job'}</td>
                  <td>{comparedJobs[1].title || 'Untitled job'}</td>
                </tr>
                <tr>
                  <th scope="row">Company</th>
                  <td>{comparedJobs[0].company || 'Unknown company'}</td>
                  <td>{comparedJobs[1].company || 'Unknown company'}</td>
                </tr>
                <tr>
                  <th scope="row">Location</th>
                  <td>{comparedJobs[0].location || 'Unknown location'}</td>
                  <td>{comparedJobs[1].location || 'Unknown location'}</td>
                </tr>
                <tr>
                  <th scope="row">Source</th>
                  <td>{comparedJobs[0].source || 'unknown'}</td>
                  <td>{comparedJobs[1].source || 'unknown'}</td>
                </tr>
                <tr>
                  <th scope="row">Seniority</th>
                  <td>{comparedJobs[0].analysis?.seniority || 'Unknown'}</td>
                  <td>{comparedJobs[1].analysis?.seniority || 'Unknown'}</td>
                </tr>
                <tr>
                  <th scope="row">Summary</th>
                  <td>{comparedJobs[0].analysis?.summary || 'Not available'}</td>
                  <td>{comparedJobs[1].analysis?.summary || 'Not available'}</td>
                </tr>
                <tr>
                  <th scope="row">Keywords</th>
                  <td>
                    {comparedJobs[0].analysis?.keywords && comparedJobs[0].analysis.keywords.length > 0
                      ? comparedJobs[0].analysis.keywords.join(', ')
                      : 'None'}
                  </td>
                  <td>
                    {comparedJobs[1].analysis?.keywords && comparedJobs[1].analysis.keywords.length > 0
                      ? comparedJobs[1].analysis.keywords.join(', ')
                      : 'None'}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Created date</th>
                  <td>{formatCreatedAt(comparedJobs[0].created_at)}</td>
                  <td>{formatCreatedAt(comparedJobs[1].created_at)}</td>
                </tr>
                <tr>
                  <th scope="row">URL</th>
                  <td>
                    {comparedJobs[0].url ? (
                      <a href={comparedJobs[0].url} target="_blank" rel="noreferrer">
                        {comparedJobs[0].url}
                      </a>
                    ) : (
                      <span className="muted">Not available</span>
                    )}
                  </td>
                  <td>
                    {comparedJobs[1].url ? (
                      <a href={comparedJobs[1].url} target="_blank" rel="noreferrer">
                        {comparedJobs[1].url}
                      </a>
                    ) : (
                      <span className="muted">Not available</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        )}
        {!jobsLoading && !jobsError && selectedJob && (
          <section className="panel job-detail-panel">
            <div className="job-detail-header">
              <h3>Job details</h3>
              <button type="button" className="secondary-button" onClick={() => setSelectedJob(null)}>
                Back to list
              </button>
            </div>

            <p>
              <strong>Title:</strong> {selectedJob.title || 'Untitled job'}
            </p>
            <p>
              <strong>Company:</strong> {selectedJob.company || 'Unknown company'}
            </p>
            <p>
              <strong>Location:</strong> {selectedJob.location || 'Unknown location'}
            </p>
            <p>
              <strong>URL:</strong>{' '}
              {selectedJob.url ? (
                <a href={selectedJob.url} target="_blank" rel="noreferrer">
                  {selectedJob.url}
                </a>
              ) : (
                <span className="muted">Not available</span>
              )}
            </p>
            <p>
              <strong>Source:</strong> {selectedJob.source || 'unknown'}
            </p>
            <p>
              <strong>Created:</strong> {formatCreatedAt(selectedJob.created_at)}
            </p>

            <div>
              <p>
                <strong>Description</strong>
              </p>
              <p className="job-description">{selectedJob.description || 'No description available.'}</p>
            </div>

            <div>
              <p>
                <strong>Analysis</strong>
              </p>
              <p>
                <strong>Seniority:</strong> {selectedJob.analysis?.seniority || 'Unknown'}
              </p>
              <p>
                <strong>Summary:</strong> {selectedJob.analysis?.summary || 'Not available'}
              </p>
              <p>
                <strong>Keywords:</strong>{' '}
                {selectedJob.analysis?.keywords && selectedJob.analysis.keywords.length > 0
                  ? selectedJob.analysis.keywords.join(', ')
                  : 'None'}
              </p>
              <p>
                <strong>Fit classification:</strong>{' '}
                {getFitLabel(selectedJob.analysis?.fit_classification)}
              </p>
              {selectedJob.analysis?.fit_rationale && (
                <p>
                  <strong>Fit rationale:</strong> {selectedJob.analysis.fit_rationale}
                </p>
              )}
              {(selectedJob.analysis?.decision?.headline?.trim() ||
                selectedJob.analysis?.decision?.detail?.trim() ||
                (selectedJob.analysis?.decision?.risk_flags?.length ?? 0) > 0 ||
                (selectedJob.analysis?.decision?.clarifying_questions?.length ?? 0) > 0) && (
                <div>
                  <p>
                    <strong>Decision</strong>
                  </p>
                  {selectedJob.analysis?.decision?.headline && (
                    <p>{selectedJob.analysis.decision.headline}</p>
                  )}
                  {selectedJob.analysis?.decision?.detail && (
                    <p>{selectedJob.analysis.decision.detail}</p>
                  )}
                  {(selectedJob.analysis?.decision?.risk_flags?.length ?? 0) > 0 && (
                    <>
                      <p>
                        <strong>Risk flags</strong>
                      </p>
                      <ul>
                        {(selectedJob.analysis?.decision?.risk_flags ?? []).map((riskFlag, index) => (
                          <li key={`job-risk-flag-${index}`}>{riskFlag}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {(selectedJob.analysis?.decision?.clarifying_questions?.length ?? 0) > 0 && (
                    <>
                      <p>
                        <strong>Clarifying questions</strong>
                      </p>
                      <ul>
                        {(selectedJob.analysis?.decision?.clarifying_questions ?? []).map(
                          (question, index) => (
                            <li key={`job-clarifying-question-${index}`}>{question}</li>
                          ),
                        )}
                      </ul>
                    </>
                  )}
                </div>
              )}
              {selectedJob.analysis?.normalized_title && (
                <p>
                  <strong>Normalized title:</strong> {selectedJob.analysis.normalized_title}
                </p>
              )}
              {selectedJob.analysis?.normalized_company && (
                <p>
                  <strong>Normalized company:</strong> {selectedJob.analysis.normalized_company}
                </p>
              )}
              {selectedJob.analysis?.normalized_location && (
                <p>
                  <strong>Normalized location:</strong> {selectedJob.analysis.normalized_location}
                </p>
              )}
            </div>
          </section>
        )}
      </section>
    </>
  )
}

export default JobsPage
