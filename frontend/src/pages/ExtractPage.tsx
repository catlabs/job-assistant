import { FormEvent, useState } from 'react'
import {
  API_BASE_URL,
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

function ExtractPage() {
  const [rawText, setRawText] = useState('')
  const [fields, setFields] = useState<ExtractFieldsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [savedJobId, setSavedJobId] = useState<string>('')

  const fitLabel = (fitClassification?: ExtractFieldsResponse['fit_classification']) => {
    if (fitClassification === 'strong_fit') {
      return 'Strong fit'
    }
    if (fitClassification === 'acceptable_intermediate') {
      return 'Acceptable intermediate'
    }
    if (fitClassification === 'misaligned') {
      return 'Misaligned'
    }
    return 'Unavailable'
  }

  const handleExtractFields = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (!rawText.trim()) {
      setFields(null)
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
    if (fields.extraction_ref) {
      payload.extraction_ref = fields.extraction_ref
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
  const decision = fields?.decision
  const hasDecision =
    Boolean(decision?.headline?.trim()) ||
    Boolean(decision?.detail?.trim()) ||
    Boolean(decision?.risk_flags?.length) ||
    Boolean(decision?.clarifying_questions?.length)

  return (
    <>
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

          <div>
            <strong>Fit:</strong> {fitLabel(fields.fit_classification)}
            {fields.fit_rationale ? <p>{fields.fit_rationale}</p> : null}
          </div>
          {hasDecision && decision && (
            <div>
              <p>
                <strong>Decision</strong>
              </p>
              {decision.headline ? <p>{decision.headline}</p> : null}
              {decision.detail ? <p>{decision.detail}</p> : null}
              {(decision.risk_flags?.length ?? 0) > 0 && (
                <>
                  <p>
                    <strong>Risk flags</strong>
                  </p>
                  <ul>
                    {(decision.risk_flags ?? []).map((riskFlag, index) => (
                      <li key={`risk-flag-${index}`}>{riskFlag}</li>
                    ))}
                  </ul>
                </>
              )}
              {(decision.clarifying_questions?.length ?? 0) > 0 && (
                <>
                  <p>
                    <strong>Clarifying questions</strong>
                  </p>
                  <ul>
                    {(decision.clarifying_questions ?? []).map((question, index) => (
                      <li key={`clarifying-question-${index}`}>{question}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <button type="button" onClick={handleSaveJob} disabled={isSaveDisabled}>
            {saveLoading ? 'Saving…' : 'Save'}
          </button>

          {saveError && <p className="error">{saveError}</p>}
          {saveSuccess && <p className="success">{saveSuccess}</p>}
          {savedJobId && <p>Saved job id: {savedJobId}</p>}
        </section>
      )}
    </>
  )
}

export default ExtractPage
