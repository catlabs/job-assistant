import { useEffect, useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { usePageHeader } from '../components/PageHeaderContext'
import JobDetailView from '../components/JobDetailView'
import { getCompensationSummary, stripWorkArrangementFromLocation } from '../lib/job-presenters'
import { ApiNotFoundError, fetchJobById, Job } from '../lib/jobs'

const COMPENSATION_POLL_INTERVAL_MS = 3000
const COMPENSATION_POLL_MAX_ATTEMPTS = 10

type JobDetailNavigationState = {
  compensationPending?: boolean
}

const hasCompensationSummary = (job: Job) => {
  const basics = job.criteria.job_basics
  const personal = job.criteria.personal_life_signals
  const location = stripWorkArrangementFromLocation(
    basics.location_text || job.location || '',
    personal.work_arrangement,
  )

  return Boolean(
    getCompensationSummary(job.criteria.financial_signals, location, basics.country),
  )
}

function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const location = useLocation()
  const navigationState = (location.state as JobDetailNavigationState | null) ?? null
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isNotFound, setIsNotFound] = useState(false)
  const [compensationLoading, setCompensationLoading] = useState(false)

  useEffect(() => {
    if (!jobId?.trim()) {
      setJob(null)
      setError('')
      setIsNotFound(true)
      setCompensationLoading(false)
      return
    }

    const loadJob = async () => {
      setLoading(true)
      setError('')
      setIsNotFound(false)
      setCompensationLoading(false)

      try {
        const nextJob = await fetchJobById(jobId)
        setJob(nextJob)
        setCompensationLoading(
          Boolean(navigationState?.compensationPending) && !hasCompensationSummary(nextJob),
        )
      } catch (jobRequestError) {
        setJob(null)
        setCompensationLoading(false)

        if (jobRequestError instanceof ApiNotFoundError) {
          setIsNotFound(true)
        } else if (jobRequestError instanceof Error) {
          setError(jobRequestError.message)
        } else {
          setError('Could not load this job.')
        }
      } finally {
        setLoading(false)
      }
    }

    void loadJob()
  }, [jobId, navigationState?.compensationPending])

  useEffect(() => {
    if (!jobId?.trim() || !compensationLoading || !job) {
      return
    }

    let cancelled = false
    let timeoutId: ReturnType<typeof window.setTimeout> | null = null
    let attempts = 0

    const pollForCompensation = async () => {
      try {
        const nextJob = await fetchJobById(jobId)
        if (cancelled) {
          return
        }

        setJob(nextJob)

        if (hasCompensationSummary(nextJob) || attempts >= COMPENSATION_POLL_MAX_ATTEMPTS) {
          setCompensationLoading(false)
          return
        }
      } catch {
        if (!cancelled) {
          setCompensationLoading(false)
        }
        return
      }

      attempts += 1
      if (attempts >= COMPENSATION_POLL_MAX_ATTEMPTS) {
        setCompensationLoading(false)
        return
      }

      timeoutId = window.setTimeout(() => {
        void pollForCompensation()
      }, COMPENSATION_POLL_INTERVAL_MS)
    }

    timeoutId = window.setTimeout(() => {
      void pollForCompensation()
    }, COMPENSATION_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [compensationLoading, job, jobId])

  const pageHeaderConfig = useMemo(
    () => ({
      title: 'Job details',
      actions: [
        {
          key: 'back',
          label: 'Back to Jobs',
          variant: 'ghost' as const,
          to: '/jobs',
        },
      ],
    }),
    [],
  )

  usePageHeader(pageHeaderConfig)

  return (
    <div className="content-page content-page-static job-detail-page">
      <div className="content-static-area">
        {(loading || error || isNotFound) && (
          <section className="content-block">
            {loading && <p>Loading job details…</p>}
            {!loading && error && <p className="error">{error}</p>}
            {!loading && !error && isNotFound && (
              <p className="muted">This job could not be found.</p>
            )}
          </section>
        )}

        {!loading && !error && !isNotFound && job && (
          <section className="job-detail-block">
            <JobDetailView job={job} compensationLoading={compensationLoading} />
          </section>
        )}
      </div>
    </div>
  )
}

export default JobDetailPage
