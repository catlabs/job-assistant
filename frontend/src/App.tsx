import { FormEvent, useState } from 'react'

type ExtractFieldsResponse = {
  title: string
  company: string
  location: string
  url: string
  source: string
  seniority: string
  summary: string
  keywords: string[]
  raw_text: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const emptyFields: ExtractFieldsResponse = {
  title: '',
  company: '',
  location: '',
  url: '',
  source: '',
  seniority: '',
  summary: '',
  keywords: [],
  raw_text: '',
}

type JobCreatePayload = {
  description: string
  title?: string
  company?: string
  location?: string
  url?: string
  source?: string
}

type JobAnalysis = {
  normalized_title?: string | null
  normalized_company?: string | null
  normalized_location?: string | null
  seniority?: string | null
  keywords?: string[] | null
  summary?: string | null
}

type Job = {
  id: string | number
  title: string | null
  company: string | null
  location: string | null
  url?: string | null
  source?: string | null
  description?: string | null
  analysis?: JobAnalysis | null
  created_at?: string | null
}

type JobListResponse = {
  count: number
  jobs: Job[]
}

const getApiErrorMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const detail = (payload as { detail?: unknown }).detail

  if (typeof detail === 'string') {
    return detail
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return ''
        }

        const message = (item as { msg?: unknown }).msg
        return typeof message === 'string' ? message : ''
      })
      .filter(Boolean)

    if (messages.length > 0) {
      return messages.join(', ')
    }
  }

  return null
}

function App() {
  const [rawText, setRawText] = useState('')
  const [fields, setFields] = useState<ExtractFieldsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [savedJobId, setSavedJobId] = useState<string>('')
  const [showJobs, setShowJobs] = useState(false)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobsError, setJobsError] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
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

  const handleExtractFields = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (!rawText.trim()) {
      setError('Please paste a job description before extracting fields.')
      return
    }

    if (!API_BASE_URL) {
      setError('Missing VITE_API_BASE_URL. Add it to frontend/.env.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/jobs/extract-fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw_text: rawText }),
      })

      if (!response.ok) {
        throw new Error('Request failed')
      }

      const data: ExtractFieldsResponse = await response.json()
      setFields({ ...emptyFields, ...data })
    } catch (_error) {
      setFields(null)
      setError('Could not extract fields. Please try again with more complete text.')
    } finally {
      setLoading(false)
    }
  }

  const handleFieldChange = (name: keyof ExtractFieldsResponse, value: string) => {
    if (!fields) {
      return
    }

    if (name === 'keywords') {
      const keywords = value
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean)

      setFields({ ...fields, keywords })
      return
    }

    setFields({ ...fields, [name]: value })
  }

  const handleSaveJob = async () => {
    setSaveError('')
    setSaveSuccess('')

    if (!fields) {
      return
    }

    const description = rawText.trim() || fields.raw_text?.trim() || ''

    if (!description) {
      setSaveError('Please provide a job description before saving.')
      return
    }

    if (!API_BASE_URL) {
      setSaveError('Missing VITE_API_BASE_URL. Add it to frontend/.env.')
      return
    }

    const payload: JobCreatePayload = { description }

    if (fields.title.trim()) {
      payload.title = fields.title.trim()
    }
    if (fields.company.trim()) {
      payload.company = fields.company.trim()
    }
    if (fields.location.trim()) {
      payload.location = fields.location.trim()
    }
    if (fields.url.trim()) {
      payload.url = fields.url.trim()
    }
    if (fields.source.trim()) {
      payload.source = fields.source.trim()
    }

    setSaveLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/jobs/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const responseBody = await response.json().catch(() => null)

      if (response.status !== 201) {
        const apiMessage = getApiErrorMessage(responseBody)
        throw new Error(apiMessage || 'Could not save this job posting.')
      }

      const jobId = (responseBody as { id?: string | number } | null)?.id
      setSavedJobId(jobId === undefined || jobId === null ? '' : String(jobId))
      setSaveSuccess('Job saved successfully.')
      if (showJobs) {
        await fetchJobs()
      }
    } catch (saveRequestError) {
      if (saveRequestError instanceof TypeError) {
        setSaveError('Network error while saving. Please check your connection and try again.')
      } else if (saveRequestError instanceof Error) {
        setSaveError(saveRequestError.message)
      } else {
        setSaveError('Could not save this job posting.')
      }
      setSavedJobId('')
    } finally {
      setSaveLoading(false)
    }
  }

  const saveDescription = rawText.trim() || fields?.raw_text?.trim() || ''
  const isSaveDisabled = !fields || !saveDescription || saveLoading
  const formatCreatedAt = (createdAt?: string | null) => {
    if (!createdAt) {
      return 'Unknown date'
    }

    const date = new Date(createdAt)
    if (Number.isNaN(date.getTime())) {
      return createdAt
    }

    return date.toLocaleString()
  }

  const handleToggleJobs = async () => {
    if (showJobs) {
      setShowJobs(false)
      setSelectedJob(null)
      setCompareSelectedIds([])
      setIsComparePanelVisible(false)
      setCompareHint('')
      return
    }

    setShowJobs(true)
    await fetchJobs()
  }

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

  const comparedJobs = compareSelectedIds
    .map((id) => jobs.find((job) => String(job.id) === id))
    .filter((job): job is Job => Boolean(job))

  const canCompare = comparedJobs.length === 2
  const shouldShowComparePanel = isComparePanelVisible && canCompare
  const handleClearComparison = () => {
    setCompareSelectedIds([])
    setIsComparePanelVisible(false)
    setCompareHint('')
  }

  return (
    <main className="page">
      <h1>Job Field Extractor</h1>
      <p>Paste a job description, then click Extract fields.</p>

      <form onSubmit={handleExtractFields} className="panel">
        <label htmlFor="rawText">Raw job description</label>
        <textarea
          id="rawText"
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          rows={10}
          placeholder="Paste job description text here"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Extracting…' : 'Extract fields'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {fields && (
        <section className="panel">
          <h2>Extracted fields (editable)</h2>

          <label>
            Title
            <input
              type="text"
              value={fields.title}
              onChange={(event) => handleFieldChange('title', event.target.value)}
            />
          </label>

          <label>
            Company
            <input
              type="text"
              value={fields.company}
              onChange={(event) => handleFieldChange('company', event.target.value)}
            />
          </label>

          <label>
            Location
            <input
              type="text"
              value={fields.location}
              onChange={(event) => handleFieldChange('location', event.target.value)}
            />
          </label>

          <label>
            URL
            <input
              type="text"
              value={fields.url}
              onChange={(event) => handleFieldChange('url', event.target.value)}
            />
          </label>

          <label>
            Source
            <input
              type="text"
              value={fields.source}
              onChange={(event) => handleFieldChange('source', event.target.value)}
            />
          </label>

          <label>
            Seniority
            <input
              type="text"
              value={fields.seniority}
              onChange={(event) => handleFieldChange('seniority', event.target.value)}
            />
          </label>

          <label>
            Summary
            <textarea
              value={fields.summary}
              onChange={(event) => handleFieldChange('summary', event.target.value)}
              rows={5}
            />
          </label>

          <label>
            Keywords (comma-separated)
            <input
              type="text"
              value={fields.keywords.join(', ')}
              onChange={(event) => handleFieldChange('keywords', event.target.value)}
            />
          </label>

          <button type="button" onClick={handleSaveJob} disabled={isSaveDisabled}>
            {saveLoading ? 'Saving…' : 'Save'}
          </button>

          {saveError && <p className="error">{saveError}</p>}
          {saveSuccess && <p className="success">{saveSuccess}</p>}
          {savedJobId && <p>Saved job id: {savedJobId}</p>}
        </section>
      )}

      <section className="panel">
        <button type="button" className="secondary-button" onClick={handleToggleJobs}>
          {showJobs ? 'Hide saved jobs' : 'Show saved jobs'}
        </button>

        {showJobs && (
          <>
            {jobsLoading && <p>Loading saved jobs…</p>}
            {jobsError && <p className="error">{jobsError}</p>}
            {!jobsLoading && !jobsError && jobs.length === 0 && (
              <p className="muted">No saved jobs yet.</p>
            )}
            {!jobsLoading && !jobsError && jobs.length > 0 && (
              <>
                <div className="jobs-list-header">
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
                <ul className="jobs-list">
                  {jobs.map((job) => {
                    const jobId = String(job.id)
                    const isSelected = selectedJob ? String(selectedJob.id) === jobId : false
                    const isCompared = compareSelectedIds.includes(jobId)
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
                          </p>
                          <p>{job.company || 'Unknown company'}</p>
                          <p>{job.location || 'Unknown location'}</p>
                          <p className="muted">
                            Source: {job.source || 'unknown'} | ID: {job.id}
                          </p>
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
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleClearComparison}
                  >
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
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setSelectedJob(null)}
                  >
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
                  <strong>Created:</strong>{' '}
                  {formatCreatedAt(selectedJob.created_at)}
                </p>

                <div>
                  <p>
                    <strong>Description</strong>
                  </p>
                  <p className="job-description">
                    {selectedJob.description || 'No description available.'}
                  </p>
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
          </>
        )}
      </section>
    </main>
  )
}

export default App
