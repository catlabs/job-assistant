import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import ExtractJobDialog from '../components/ExtractJobDialog'
import TechnicalSignalChips from '../components/TechnicalSignalChips'
import { usePageHeader } from '../components/PageHeaderContext'
import { apiFetch, getApiBaseUrl } from '../lib/api'
import {
  buildSecondaryJobMeta,
  getCompensationListLabel,
  getWorkArrangementIcon,
  isKnownValue,
  isTextValue,
  stripWorkArrangementFromLocation,
} from '../lib/job-presenters'
import {
  getApiErrorMessage,
  getSignalLabel,
  getWorkArrangementLabel,
  Job,
  JobListResponse,
} from '../lib/jobs'

function JobsPage() {
  const navigate = useNavigate()
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobsError, setJobsError] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [compareSelectedIds, setCompareSelectedIds] = useState<string[]>([])
  const [compareHint, setCompareHint] = useState('')
  const [isExtractDialogOpen, setIsExtractDialogOpen] = useState(false)

  const fetchJobs = async () => {
    setJobsError('')

    try {
      getApiBaseUrl()
    } catch (baseUrlError) {
      setJobsError(
        baseUrlError instanceof Error
          ? baseUrlError.message
          : 'Missing VITE_API_BASE_URL. Add it to frontend/.env.',
      )
      setJobs([])
      return
    }

    setJobsLoading(true)

    try {
      const response = await apiFetch('/jobs/')
      const responseBody = await response.json().catch(() => null)

      if (!response.ok) {
        const apiMessage = getApiErrorMessage(responseBody)
        throw new Error(apiMessage || 'Could not load saved jobs.')
      }

      const data = responseBody as JobListResponse
      const nextJobs = Array.isArray(data.jobs) ? data.jobs : []
      setJobs(nextJobs)
      setCompareSelectedIds((currentIds) => {
        const availableIds = new Set(nextJobs.map((job) => String(job.id)))
        return currentIds.filter((id) => availableIds.has(id))
      })
    } catch (jobsRequestError) {
      if (jobsRequestError instanceof TypeError) {
        setJobsError(
          'Network error while loading jobs. Please check your connection and try again.',
        )
      } else if (jobsRequestError instanceof Error) {
        setJobsError(jobsRequestError.message)
      } else {
        setJobsError('Could not load saved jobs.')
      }
      setJobs([])
      setCompareSelectedIds([])
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

      if (currentIds.length >= 2) {
        setCompareHint('Select only 2 jobs to compare.')
        return currentIds
      }

      return [...currentIds, jobId]
    })
  }

  const canCompare = compareSelectedIds.length === 2

  const handleCompareNavigation = useCallback(() => {
    if (!canCompare) {
      return
    }

    const [a, b] = compareSelectedIds
    const params = new URLSearchParams({ a, b })
    navigate(`/jobs/compare?${params.toString()}`)
  }, [canCompare, compareSelectedIds, navigate])

  const headerActions = useMemo(
    () => [
      {
        key: 'add-job',
        label: 'Add job',
        onClick: () => setIsExtractDialogOpen(true),
      },
    ],
    [],
  )

  const pageHeaderConfig = useMemo(
    () => ({
      title: 'Jobs',
      actions: headerActions,
    }),
    [headerActions],
  )

  usePageHeader(pageHeaderConfig)

  return (
    <div className="content-page">
      <div className="content-scroll-area">
        <section className="content-block">
          <section className="panel">
            {jobsLoading && <p>Loading saved jobs…</p>}
            {jobsError && <p className="error">{jobsError}</p>}
            {!jobsLoading && !jobsError && jobs.length === 0 && (
              <p className="muted">No saved jobs yet.</p>
            )}
            {!jobsLoading && !jobsError && jobs.length > 0 && (
              <>
                <div className="jobs-list-header">
                  <p className="jobs-list-count">
                    {jobs.length} job{jobs.length === 1 ? '' : 's'}
                  </p>
                  <Button type="button" onClick={handleCompareNavigation} disabled={!canCompare}>
                    Compare selected
                  </Button>
                </div>
                {compareHint && <p className="muted compare-hint">{compareHint}</p>}
                <ul className="jobs-list">
                  {jobs.map((job) => {
                    const jobId = String(job.id)
                    const isCompared = compareSelectedIds.includes(jobId)
                    const criteria = job.criteria
                    const basics = criteria.job_basics
                    const personal = criteria.personal_life_signals
                    const location = stripWorkArrangementFromLocation(
                      job.location || basics.location_text || '',
                      personal.work_arrangement,
                    )
                    const workArrangement = getWorkArrangementLabel(personal.work_arrangement)
                    const compensation = getCompensationListLabel(
                      criteria.financial_signals,
                      location,
                      basics.country,
                    )
                    const confidence = getSignalLabel(criteria.extraction_quality.confidence_level)
                    const secondaryMeta = buildSecondaryJobMeta(basics)
                    const summary = basics.job_summary?.trim() ?? ''
                    const WorkArrangementIcon = getWorkArrangementIcon(personal.work_arrangement)

                    return (
                      <li
                        key={job.id}
                        className={`job-item ${isCompared ? 'job-item-selected' : ''}`}
                        onClick={() => navigate(`/jobs/${jobId}`)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            navigate(`/jobs/${jobId}`)
                          }
                        }}
                        role="link"
                        tabIndex={0}
                      >
                        <div className="job-item-checkbox">
                          <input
                            type="checkbox"
                            checked={isCompared}
                            onChange={(event) => {
                              event.stopPropagation()
                              handleToggleCompareSelection(jobId)
                            }}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`Select ${job.title || basics.title || 'job'} for comparison`}
                          />
                        </div>

                        <div className="job-item-body">
                          <div className="job-item-header">
                            <div className="job-item-header-main">
                              <h3 className="job-item-title">
                                {job.title || basics.title || 'Untitled job'}
                              </h3>
                              <p className="job-item-primary-meta">
                                {isTextValue(job.company || basics.company_name) ? (
                                  <span>{job.company || basics.company_name}</span>
                                ) : null}
                                {isTextValue(location) ? (
                                  <>
                                    {isTextValue(job.company || basics.company_name) ? (
                                      <span className="job-item-meta-separator" aria-hidden="true">
                                        •
                                      </span>
                                    ) : null}
                                    <span>{location}</span>
                                  </>
                                ) : null}
                                {isKnownValue(personal.work_arrangement) ? (
                                  <>
                                    {isTextValue(job.company || basics.company_name) ||
                                    isTextValue(location) ? (
                                      <span className="job-item-meta-separator" aria-hidden="true">
                                        •
                                      </span>
                                    ) : null}
                                    <span className="job-item-work-arrangement">
                                      <span
                                        className="job-item-work-arrangement-icon"
                                        aria-hidden="true"
                                      >
                                        {WorkArrangementIcon ? (
                                          <WorkArrangementIcon size={13} strokeWidth={2} />
                                        ) : null}
                                      </span>
                                      {workArrangement}
                                    </span>
                                  </>
                                ) : null}
                              </p>
                              {secondaryMeta.length > 0 ? (
                                <p className="job-item-secondary-meta">
                                  {secondaryMeta.join(' — ')}
                                </p>
                              ) : null}
                              {compensation ? (
                                <p className="job-item-compensation">
                                  <span className="job-item-compensation-label">Compensation:</span>
                                  <span className="job-item-compensation-value">
                                    {compensation}
                                  </span>
                                </p>
                              ) : null}
                              {summary ? <p className="job-item-summary">{summary}</p> : null}
                            </div>
                            <div className="job-item-header-side">
                              <span className="job-item-confidence">Confidence: {confidence}</span>
                            </div>
                          </div>

                          <TechnicalSignalChips
                            skills={criteria.technical_signals.skills}
                            limit={4}
                            compact
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </section>
        </section>
      </div>

      <ExtractJobDialog open={isExtractDialogOpen} onClose={() => setIsExtractDialogOpen(false)} />
    </div>
  )
}

export default JobsPage
