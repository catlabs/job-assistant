import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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

  return (
    <>
      <section className="page-heading">
        <h1>Job Details</h1>
      </section>

      <section className="panel job-detail-panel">
        <div className="job-detail-header">
          <h3>Job details</h3>
          <Link to="/jobs" className="secondary-button">
            Back to jobs
          </Link>
        </div>
        {loading && <p>Loading job details…</p>}
        {!loading && error && <p className="error">{error}</p>}
        {!loading && !error && isNotFound && <p className="muted">This job could not be found.</p>}
        {!loading && !error && !isNotFound && job && <JobDetailView job={job} />}
      </section>
    </>
  )
}

export default JobDetailPage
