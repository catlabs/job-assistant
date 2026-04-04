import { FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BlockingLoadingOverlay from '../components/BlockingLoadingOverlay'
import Button from '../components/Button'
import { apiFetch, getApiBaseUrl, getJsonHeaders } from '../lib/api'
import {
  emptyFields,
  estimateCompensation,
  extractJobFields,
  ExtractFieldsResponse,
  formatCompensationSummary,
  getApiErrorMessage,
  getSignalLabel,
  getWorkArrangementLabel,
  JobCreatePayload,
} from '../lib/jobs'

function ExtractPage() {
  const navigate = useNavigate()
  const [rawText, setRawText] = useState('')
  const [fields, setFields] = useState<ExtractFieldsResponse | null>(null)
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [modelLoadError, setModelLoadError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [compensationLoading, setCompensationLoading] = useState(false)
  const [compensationError, setCompensationError] = useState('')
  const [compensationStatus, setCompensationStatus] = useState('')
  const compensationRunRef = useRef(0)

  useEffect(() => {
    let cancelled = false

    const loadExtractionModels = async () => {
      try {
        getApiBaseUrl()
      } catch {
        return
      }

      try {
        const response = await apiFetch('/jobs/extraction-models')
        const body = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error('Request failed')
        }

        const responseDefaultModel =
          body && typeof body === 'object' && typeof (body as { default_model?: unknown }).default_model === 'string'
            ? (body as { default_model: string }).default_model
            : ''
        const responseModels =
          body && typeof body === 'object' && Array.isArray((body as { models?: unknown }).models)
            ? (body as { models: unknown[] }).models.filter(
                (item): item is string => typeof item === 'string' && item.length > 0,
              )
            : []

        if (!responseDefaultModel || responseModels.length === 0) {
          throw new Error('Invalid response')
        }

        if (!cancelled) {
          setModels(responseModels)
          setSelectedModel(responseDefaultModel)
          setModelLoadError('')
        }
      } catch {
        if (!cancelled) {
          setModels([])
          setSelectedModel('')
          setModelLoadError('Model list unavailable. Using backend default model.')
        }
      }
    }

    loadExtractionModels()

    return () => {
      cancelled = true
    }
  }, [])

  const handleExtractFields = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (!rawText.trim()) {
      setFields(null)
      setError('Please paste a job description before analyzing it.')
      return
    }

    try {
      getApiBaseUrl()
    } catch (baseUrlError) {
      setError(baseUrlError instanceof Error ? baseUrlError.message : 'Missing VITE_API_BASE_URL. Add it to frontend/.env.')
      return
    }

    setLoading(true)
    const runId = compensationRunRef.current + 1
    compensationRunRef.current = runId
    setCompensationLoading(false)
    setCompensationError('')
    setCompensationStatus('')

    try {
      const model = models.length > 0 && selectedModel ? selectedModel : undefined
      const data = await extractJobFields(rawText, model)
      setFields({ ...emptyFields, ...data })
      void runCompensationEstimation(data, runId, model)
    } catch (extractError) {
      setFields(null)
      if (extractError instanceof Error) {
        setError(extractError.message)
      } else {
        setError('Could not analyze this job. Please try again with more complete text.')
      }
    } finally {
      setLoading(false)
    }
  }

  const runCompensationEstimation = async (data: ExtractFieldsResponse, runId: number, model?: string) => {
    setCompensationLoading(true)
    setCompensationError('')
    setCompensationStatus('Estimating compensation…')

    try {
      const result = await estimateCompensation(data.raw_text, data.criteria, model)
      if (runId !== compensationRunRef.current) {
        return
      }

      if (result.status === 'completed') {
        setFields((prev) =>
          prev
            ? {
                ...prev,
                criteria: {
                  ...prev.criteria,
                  financial_signals: {
                    ...prev.criteria.financial_signals,
                    estimated_compensation: result.estimated_compensation,
                  },
                },
              }
            : prev,
        )
        setCompensationStatus('Compensation estimate updated.')
        return
      }

      if (result.status === 'skipped') {
        if (result.reason === 'explicit_compensation_present') {
          setCompensationStatus('Compensation estimation skipped: explicit compensation already present.')
        } else {
          setCompensationStatus('Compensation estimation skipped.')
        }
        return
      }

      setCompensationStatus('')
      setCompensationError('Compensation estimation failed. You can continue with extracted criteria.')
    } catch (compensationRequestError) {
      if (runId !== compensationRunRef.current) {
        return
      }
      setCompensationStatus('')
      if (compensationRequestError instanceof Error) {
        setCompensationError(compensationRequestError.message)
      } else {
        setCompensationError('Compensation estimation failed. You can continue with extracted criteria.')
      }
    } finally {
      if (runId === compensationRunRef.current) {
        setCompensationLoading(false)
      }
    }
  }

  const handleSaveJob = async () => {
    setSaveError('')

    if (!fields) {
      return
    }

    const description = rawText.trim() || fields.raw_text?.trim() || ''
    if (!description) {
      setSaveError('Please provide a job description before saving.')
      return
    }

    try {
      getApiBaseUrl()
    } catch (baseUrlError) {
      setSaveError(baseUrlError instanceof Error ? baseUrlError.message : 'Missing VITE_API_BASE_URL. Add it to frontend/.env.')
      return
    }

    const basics = fields.criteria.job_basics
    const payload: JobCreatePayload = {
      description,
      title: basics.title || undefined,
      company: basics.company_name || undefined,
      location: basics.location_text || undefined,
      criteria: fields.criteria,
    }

    setSaveLoading(true)
    let savedJobId: string | null = null

    try {
      const response = await apiFetch('/jobs/', {
        method: 'POST',
        headers: getJsonHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(payload),
      })

      const responseBody = await response.json().catch(() => null)

      if (response.status !== 201) {
        const apiMessage = getApiErrorMessage(responseBody)
        throw new Error(apiMessage || 'Could not save this job posting.')
      }

      const jobId = (responseBody as { id?: string | number } | null)?.id
      if (jobId === undefined || jobId === null) {
        throw new Error('Job saved but no job id was returned.')
      }

      savedJobId = String(jobId)
      setIsRedirecting(true)
      navigate(`/jobs/${savedJobId}`, {
        state: {
          compensationPending: compensationLoading,
        },
      })
    } catch (saveRequestError) {
      if (saveRequestError instanceof TypeError) {
        setSaveError('Network error while saving. Please check your connection and try again.')
      } else if (saveRequestError instanceof Error) {
        setSaveError(saveRequestError.message)
      } else {
        setSaveError('Could not save this job posting.')
      }
    } finally {
      if (!savedJobId) {
        setSaveLoading(false)
      }
    }
  }

  const criteria = fields?.criteria
  const isBusy = loading || saveLoading || isRedirecting

  return (
    <div className="content-page extract-page-shell">
      <BlockingLoadingOverlay
        open={loading}
        title="Extracting job criteria"
        message="Analyzing the job posting and structuring key signals. This can take a few seconds."
      />
      <section className="page-heading content-block">
        <h1>Job Criteria Extractor</h1>
        <p className="page-subtitle">Paste a job description, extract criteria, then save it.</p>
      </section>

      <div className="content-scroll-area">
        <section className="content-block">
          <form onSubmit={handleExtractFields} className="panel">
            <label htmlFor="rawText">Raw job description</label>
            <textarea
              id="rawText"
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              rows={10}
              placeholder="Paste job description text here"
              disabled={isBusy}
            />
            {models.length > 0 && (
              <label htmlFor="extractionModel">
                Model
                <select
                  id="extractionModel"
                  value={selectedModel}
                  onChange={(event) => setSelectedModel(event.target.value)}
                  disabled={isBusy}
                >
                  {models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {modelLoadError && <p className="muted">{modelLoadError}</p>}
            <Button type="submit" disabled={isBusy}>
              {loading ? 'Extracting…' : 'Extract criteria'}
            </Button>
          </form>
        </section>

        {error && (
          <section className="content-block">
            <p className="error">{error}</p>
          </section>
        )}

        {criteria && (
          <section className="content-block">
            <section className="panel detail-section">
              <h2>Extracted criteria</h2>
              <p className="muted">
                {criteria.job_basics.title || 'Untitled role'} at {criteria.job_basics.company_name || 'Unknown company'}
              </p>
              <p>{criteria.job_basics.job_summary || 'No summary extracted.'}</p>
              <p>
                {criteria.job_basics.location_text || 'Location unknown'} ·{' '}
                {getWorkArrangementLabel(criteria.personal_life_signals.work_arrangement)} ·{' '}
                {formatCompensationSummary(criteria.financial_signals)}
              </p>
              {compensationLoading && <p className="muted">Estimating compensation…</p>}
              {!compensationLoading && compensationStatus && <p className="muted">{compensationStatus}</p>}
              {compensationError && <p className="error">{compensationError}</p>}
              <p>
                Seniority: {getSignalLabel(criteria.job_basics.seniority_level)} | Confidence:{' '}
                {getSignalLabel(criteria.extraction_quality.confidence_level)}
              </p>
              <p>
                Skills: {criteria.technical_signals.skills.map((skill) => skill.name).join(', ') || 'None detected'}
              </p>
              {criteria.extraction_quality.missing_critical_information.length > 0 ? (
                <p className="muted">
                  Missing info: {criteria.extraction_quality.missing_critical_information.join(', ')}
                </p>
              ) : null}
              {saveError && <p className="error">{saveError}</p>}
              <Button type="button" onClick={handleSaveJob} disabled={isBusy}>
                {saveLoading ? 'Saving…' : 'Save job'}
              </Button>
            </section>
          </section>
        )}
      </div>
    </div>
  )
}

export default ExtractPage
