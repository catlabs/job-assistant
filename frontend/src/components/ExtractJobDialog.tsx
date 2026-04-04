import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, getApiBaseUrl } from '../lib/api'
import BlockingLoadingOverlay from './BlockingLoadingOverlay'
import Button from './Button'
import { createJob, extractJobFields } from '../lib/jobs'

type ExtractJobDialogProps = {
  open: boolean
  onClose: () => void
}

function ExtractJobDialog({ open, onClose }: ExtractJobDialogProps) {
  const navigate = useNavigate()
  const [rawText, setRawText] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [modelLoadError, setModelLoadError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isRedirecting, setIsRedirecting] = useState(false)

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

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading && !isRedirecting) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isRedirecting, loading, onClose, open])

  const handleSaveJob = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    const description = rawText.trim()

    if (!description) {
      setError('Please paste a job description before saving.')
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
      const model = models.length > 0 && selectedModel ? selectedModel : undefined
      const extracted = await extractJobFields(description, model)
      const basics = extracted.criteria.job_basics
      const savedJob = await createJob({
        description,
        title: basics.title || undefined,
        company: basics.company_name || undefined,
        location: basics.location_text || undefined,
        criteria: extracted.criteria,
      })
      const jobId = savedJob.id
      if (jobId === undefined || jobId === null) {
        throw new Error('Job saved but no job id was returned.')
      }

      setIsRedirecting(true)
      navigate(`/jobs/${String(jobId)}`, {
        state: {
          compensationPending: true,
        },
      })
    } catch (submitError) {
      if (submitError instanceof Error) {
        setError(submitError.message)
      } else {
        setError('Could not save this job posting.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return null
  }

  if (loading) {
    return (
      <BlockingLoadingOverlay
        open
        fullScreen
        modal
        title="Extracting job criteria"
        message="Analyzing the job posting and structuring key signals. This can take a few seconds."
      />
    )
  }

  const isBusy = loading || isRedirecting

  return (
    <div className="dialog-backdrop" role="presentation" onClick={isBusy ? undefined : onClose}>
      <section
        className="dialog-panel dialog-panel-wide extract-job-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extract-job-title"
        aria-busy={isBusy}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <h2 id="extract-job-title">Extract job criteria</h2>
          <button
            type="button"
            className="dialog-close-button"
            onClick={onClose}
            aria-label="Close dialog"
            disabled={isBusy}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSaveJob} className="dialog-body detail-section">
          <label htmlFor="extractJobRawText">
            Raw job description
            <textarea
              id="extractJobRawText"
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              rows={10}
              placeholder="Paste job description text here"
              disabled={isBusy}
            />
          </label>

          {models.length > 0 ? (
            <label htmlFor="extractJobModel">
              Model
              <select
                id="extractJobModel"
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
          ) : null}

          {modelLoadError ? <p className="muted">{modelLoadError}</p> : null}
          {error ? <p className="error">{error}</p> : null}

          <div className="dialog-actions">
            <Button type="submit" disabled={isBusy}>
              {loading ? 'Saving…' : 'Save job'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default ExtractJobDialog
