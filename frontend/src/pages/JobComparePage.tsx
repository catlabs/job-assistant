import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import JobCompareTable from '../components/JobCompareTable'
import { ApiNotFoundError, fetchJobById, Job } from '../lib/jobs'

function JobComparePage() {
  const [searchParams] = useSearchParams()
  const [jobs, setJobs] = useState<[Job, Job] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const compareIds = useMemo(() => {
    const a = searchParams.get('a')?.trim() ?? ''
    const b = searchParams.get('b')?.trim() ?? ''

    if (!a || !b || a === b) {
      return null
    }

    return [a, b] as const
  }, [searchParams])

  useEffect(() => {
    if (!compareIds) {
      setJobs(null)
      setLoading(false)
      setError('')
      return
    }

    const [firstId, secondId] = compareIds

    const loadJobs = async () => {
      setLoading(true)
      setError('')

      try {
        const [firstJob, secondJob] = await Promise.all([
          fetchJobById(firstId, 'Could not load selected jobs.'),
          fetchJobById(secondId, 'Could not load selected jobs.'),
        ])

        setJobs([firstJob, secondJob])
      } catch (jobsRequestError) {
        setJobs(null)

        if (jobsRequestError instanceof ApiNotFoundError) {
          setError('One or both selected jobs could not be found.')
        } else if (jobsRequestError instanceof Error) {
          setError(jobsRequestError.message)
        } else {
          setError('Could not load selected jobs.')
        }
      } finally {
        setLoading(false)
      }
    }

    void loadJobs()
  }, [compareIds])

  if (!compareIds) {
    return (
      <>
        <section className="page-heading">
          <h1>Compare Jobs</h1>
        </section>
        <section className="panel">
          <p className="muted">Choose two different jobs to compare from the saved jobs list.</p>
          <Link to="/jobs" className="secondary-button">
            Back to jobs
          </Link>
        </section>
      </>
    )
  }

  return (
    <>
      <section className="page-heading">
        <h1>Compare Jobs</h1>
      </section>

      <section className="panel">
        <div className="job-detail-header">
          <h3>Job comparison</h3>
          <Link to="/jobs" className="secondary-button">
            Back to jobs
          </Link>
        </div>
        {loading && <p>Loading selected jobs…</p>}
        {!loading && error && <p className="error">{error}</p>}
        {!loading && !error && jobs && <JobCompareTable firstJob={jobs[0]} secondJob={jobs[1]} />}
      </section>
    </>
  )
}

export default JobComparePage
