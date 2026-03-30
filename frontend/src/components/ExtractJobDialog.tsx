import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, getApiBaseUrl, getJsonHeaders } from '../lib/api'
import Button from './Button'
import FitBadge from './FitBadge'
import {
  emptyFields,
  ExtractFieldsResponse,
  getApiErrorMessage,
  JobCreatePayload,
} from '../lib/jobs'

type EditableExtractField =
  | 'title'
  | 'company'
  | 'location'
  | 'url'
  | 'source'
  | 'seniority'
  | 'summary'
  | 'keywords'

type ExtractJobDialogProps = {
  open: boolean
  onClose: () => void
}

function ExtractJobDialog({ open, onClose }: ExtractJobDialogProps) {
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
  const [saveSuccess, setSaveSuccess] = useState('')
  const [savedJobId, setSavedJobId] = useState<string>('')

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
      } catch (_loadError) {
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

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  const handleExtractFields = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (!rawText.trim()) {
      setFields(null)
      setError('Please paste a job description before extracting fields.')
      return
    }

    try {
      getApiBaseUrl()
    } catch (baseUrlError) {
      setError(baseUrlError instanceof Error ? baseUrlError.message : 'Missing VITE_API_BASE_URL. Add it to frontend/.env.')
      return
    }

    setLoading(true)

    try {
      const requestBody: { raw_text: string; model?: string } = { raw_text: rawText }
      if (models.length > 0 && selectedModel) {
        requestBody.model = selectedModel
      }

      const response = await apiFetch('/jobs/extract-fields', {
        method: 'POST',
        headers: getJsonHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error('Request failed')
      }

      const data: ExtractFieldsResponse = await response.json()
      setFields({ ...emptyFields, ...data })
    } catch (_requestError) {
      setFields(null)
      setError('Could not extract fields. Please try again with more complete text.')
    } finally {
      setLoading(false)
    }
  }

  const handleFieldChange = (name: EditableExtractField, value: string) => {
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

    try {
      getApiBaseUrl()
    } catch (baseUrlError) {
      setSaveError(baseUrlError instanceof Error ? baseUrlError.message : 'Missing VITE_API_BASE_URL. Add it to frontend/.env.')
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
    if (fields.extraction_ref) {
      payload.extraction_ref = fields.extraction_ref
    }

    setSaveLoading(true)

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

      const createdJobId = String(jobId)
      setSavedJobId(createdJobId)
      setSaveSuccess('Job saved successfully.')
      onClose()
      navigate(`/jobs/${createdJobId}`)
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

  if (!open) {
    return null
  }

  const saveDescription = rawText.trim() || fields?.raw_text?.trim() || ''
  const isSaveDisabled = !fields || !saveDescription || saveLoading
  const decision = fields?.decision
  const hasDecision =
    Boolean(decision?.headline?.trim()) ||
    Boolean(decision?.detail?.trim()) ||
    Boolean(decision?.risk_flags?.length) ||
    Boolean(decision?.clarifying_questions?.length)
  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="dialog-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="extract-job-dialog-title"
      >
        <div className="dialog-header">
          <div>
            <h2 id="extract-job-dialog-title">Add job</h2>
            <p className="page-subtitle">Paste a job description, review the analysis, then save it to Jobs.</p>
          </div>
          <Button type="button" variant="ghost" size="compact" className="header-action-button" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="dialog-body">
          <form onSubmit={handleExtractFields} className="panel">
            <label htmlFor="rawText">Raw job description</label>
            <textarea
              id="rawText"
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              rows={10}
              placeholder="Paste job description text here"
            />
            {models.length > 0 && (
              <label htmlFor="extractionModel">
                Model
                <select
                  id="extractionModel"
                  value={selectedModel}
                  onChange={(event) => setSelectedModel(event.target.value)}
                  disabled={loading}
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
            <Button type="submit" disabled={loading}>
              {loading ? 'Analyzing…' : 'Analyze job'}
            </Button>
          </form>

          {error && <p className="error">{error}</p>}

          {fields && (
            <section className="panel">
              <h2>Extracted fields (editable)</h2>

              <div className="detail-section">
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
              </div>

              <div className="detail-section">
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
              </div>

              <div className="detail-section">
                <div className="fit-summary">
                  <strong>Fit:</strong>
                  <FitBadge fitClassification={fields?.fit_classification} fallbackLabel="Unavailable" />
                </div>
                {fields.fit_rationale ? <p className="fit-rationale">{fields.fit_rationale}</p> : null}
              </div>

              {hasDecision && decision && (
                <div className="decision-block">
                  <p className="decision-heading">Decision</p>
                  {decision.headline ? <p>{decision.headline}</p> : null}
                  {decision.detail ? <p>{decision.detail}</p> : null}
                  {(decision.risk_flags?.length ?? 0) > 0 && (
                    <>
                      <p className="section-heading">
                        <strong>Risk flags</strong>
                      </p>
                      <ul className="decision-list">
                        {(decision.risk_flags ?? []).map((riskFlag, index) => (
                          <li key={`risk-flag-${index}`}>{riskFlag}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {(decision.clarifying_questions?.length ?? 0) > 0 && (
                    <>
                      <p className="section-heading">
                        <strong>Clarifying questions</strong>
                      </p>
                      <ul className="decision-list">
                        {(decision.clarifying_questions ?? []).map((question, index) => (
                          <li key={`clarifying-question-${index}`}>{question}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}

              <div className="detail-section">
                <Button type="button" onClick={handleSaveJob} disabled={isSaveDisabled}>
                  {saveLoading ? 'Saving…' : 'Save job'}
                </Button>

                {saveError && <p className="error">{saveError}</p>}
                {saveSuccess && <p className="success">{saveSuccess}</p>}
                {savedJobId && <p className="muted">Saved job id: {savedJobId}</p>}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

export default ExtractJobDialog
