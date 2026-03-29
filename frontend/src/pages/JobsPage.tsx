import FitIcon from '../components/FitIcon'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import ExtractJobDialog from '../components/ExtractJobDialog'
import { usePageHeader } from '../components/PageHeaderContext'
import { API_BASE_URL, getApiErrorMessage, Job, JobListResponse } from '../lib/jobs'
import { FitFilter } from '../lib/jobDisplay'

function JobsPage() {
  const navigate = useNavigate()
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobsError, setJobsError] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [fitFilter, setFitFilter] = useState<FitFilter>('all')
  const [compareSelectedIds, setCompareSelectedIds] = useState<string[]>([])
  const [compareHint, setCompareHint] = useState('')
  const [isExtractDialogOpen, setIsExtractDialogOpen] = useState(false)

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
      setCompareSelectedIds((currentIds) => {
        const availableIds = new Set(nextJobs.map((job) => String(job.id)))
        return currentIds.filter((id) => availableIds.has(id))
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

      // Preserve selection order because compare URL order should stay stable.
      if (currentIds.length >= 2) {
        setCompareHint('Select only 2 jobs to compare.')
        return currentIds
      }

      return [...currentIds, jobId]
    })
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
            {!jobsLoading && !jobsError && jobs.length === 0 && <p className="muted">No saved jobs yet.</p>}
            {!jobsLoading && !jobsError && jobs.length > 0 && (
              <>
                <div className="jobs-list-header">
                  <div className="fit-filter-control">
                    <select
                      className="compact-select"
                      aria-label="Filter jobs by fit"
                      value={fitFilter}
                      onChange={(event) => {
                        setFitFilter(event.target.value as FitFilter)
                        setCompareSelectedIds([])
                        setCompareHint('')
                      }}
                    >
                      <option value="all">All</option>
                      <option value="strong_fit">Strong fit</option>
                      <option value="acceptable_intermediate">Acceptable / Intermediate</option>
                      <option value="misaligned">Misaligned</option>
                      <option value="unassessed">Unassessed</option>
                    </select>
                  </div>
                  <p className="jobs-list-count">
                    {filteredJobs.length} job{filteredJobs.length === 1 ? '' : 's'}
                  </p>
                </div>
                {compareHint && <p className="muted compare-hint">{compareHint}</p>}
                {filteredJobs.length === 0 && <p className="muted">No jobs match this fit filter.</p>}
                <ul className="jobs-list">
                  {filteredJobs.map((job) => {
                    const jobId = String(job.id)
                    const isCompared = compareSelectedIds.includes(jobId)
                    const fitClassification = job.analysis?.fit_classification
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
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => {
                              event.stopPropagation()
                              handleToggleCompareSelection(jobId)
                            }}
                            onKeyDown={(event) => event.stopPropagation()}
                            aria-label={`Compare ${job.title || `job ${job.id}`}`}
                          />
                        </div>
                        <div className="job-item-content">
                          <div className="job-item-topline">
                            <p className="job-item-title">{job.title || 'Untitled job'}</p>
                            {fitClassification && <FitIcon fitClassification={fitClassification} />}
                          </div>
                          <p className="job-item-primary-meta">
                            <span>{job.company || 'Unknown company'}</span>
                            <span className="job-item-meta-separator" aria-hidden="true">
                              •
                            </span>
                            <span>{job.location || 'Unknown location'}</span>
                          </p>
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

      {canCompare && (
        <div className="jobs-compare-float" role="status" aria-live="polite">
          <p className="jobs-compare-float-copy">2 jobs selected</p>
          <Button type="button" size="compact" onClick={handleCompareNavigation}>
            Compare jobs
          </Button>
        </div>
      )}

      <ExtractJobDialog open={isExtractDialogOpen} onClose={() => setIsExtractDialogOpen(false)} />
    </div>
  )
}

export default JobsPage
