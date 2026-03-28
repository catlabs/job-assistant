import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePageHeader } from '../components/PageHeaderContext'
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

  const pageHeaderConfig = useMemo(
    () => ({
      title: 'Compare jobs',
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

  if (!compareIds) {
    return (
      <div className="content-page">
        <div className="content-scroll-area">
          <section className="content-block">
            <section className="panel">
              <p className="muted">Choose two different jobs to compare from the saved jobs list.</p>
            </section>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="content-page">
      <div className="content-scroll-area">
        <section className="content-block">
          <section className="panel">
            {loading && <p>Loading selected jobs…</p>}
            {!loading && error && <p className="error">{error}</p>}
            {!loading && !error && jobs && <JobCompareTable firstJob={jobs[0]} secondJob={jobs[1]} />}
          </section>
        </section>
      </div>
    </div>
  )
}

export default JobComparePage
