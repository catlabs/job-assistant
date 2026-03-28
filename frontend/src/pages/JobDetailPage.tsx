import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { usePageHeader } from '../components/PageHeaderContext'
import JobDetailView from '../components/JobDetailView'
import { ApiNotFoundError, fetchJobById, Job } from '../lib/jobs'

function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isNotFound, setIsNotFound] = useState(false)

  useEffect(() => {
    if (!jobId?.trim()) {
      setJob(null)
      setError('')
      setIsNotFound(true)
      return
    }

    const loadJob = async () => {
      setLoading(true)
      setError('')
      setIsNotFound(false)

      try {
        const nextJob = await fetchJobById(jobId)
        setJob(nextJob)
      } catch (jobRequestError) {
        setJob(null)

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
  }, [jobId])

  const pageHeaderConfig = useMemo(
    () => ({
      title: 'Job details',
      actions: [
        {
          key: 'back',
          label: 'Back to Jobs',
          variant: 'secondary' as const,
          to: '/jobs',
        },
      ],
    }),
    [],
  )

  usePageHeader(pageHeaderConfig)

  return (
    <div className="content-page">
      <div className="content-scroll-area">
        <section className="content-block">
          <section className="panel job-detail-panel">
            {loading && <p>Loading job details…</p>}
            {!loading && error && <p className="error">{error}</p>}
            {!loading && !error && isNotFound && <p className="muted">This job could not be found.</p>}
            {!loading && !error && !isNotFound && job && <JobDetailView job={job} />}
          </section>
        </section>
      </div>
    </div>
  )
}

export default JobDetailPage
