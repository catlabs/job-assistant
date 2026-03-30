import { FormEvent, useEffect, useState } from 'react'
import Button from './Button'
import { ingestCompany } from '../lib/companies'

const EMPTY_ADDITIONAL_URL = ''

type AddCompanyDialogProps = {
  open: boolean
  onClose: () => void
  onCreated: (companyId: string) => void
}

function AddCompanyDialog({ open, onClose, onCreated }: AddCompanyDialogProps) {
  const [url, setUrl] = useState('')
  const [additionalUrls, setAdditionalUrls] = useState<string[]>([EMPTY_ADDITIONAL_URL])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setUrl('')
      setAdditionalUrls([EMPTY_ADDITIONAL_URL])
      setLoading(false)
      setError('')
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [loading, onClose, open])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    const nextUrl = url.trim()
    if (!nextUrl) {
      setError('Enter a company URL to ingest.')
      return
    }

    const nextAdditionalUrls = additionalUrls.map((value) => value.trim()).filter(Boolean)

    setLoading(true)

    try {
      const company = await ingestCompany({ url: nextUrl, additional_source_urls: nextAdditionalUrls })
      onCreated(company.id)
      onClose()
    } catch (ingestError) {
      if (ingestError instanceof Error) {
        setError(ingestError.message)
      } else {
        setError('Could not ingest this company.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return null
  }

  const canAddAdditionalUrl = additionalUrls.length < 5

  return (
    <div className="dialog-backdrop" role="presentation" onClick={() => !loading && onClose()}>
      <section
        className="dialog-panel company-dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-company-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <div>
            <h2 id="add-company-title">Add company</h2>
            <p className="muted">Ingest a small same-domain company context snapshot from a website URL.</p>
          </div>
          <Button variant="ghost" size="compact" onClick={onClose} disabled={loading}>
            Close
          </Button>
        </div>

        <form className="dialog-body company-dialog-body" onSubmit={handleSubmit}>
          <label>
            Company URL
            <input
              type="url"
              name="companyUrl"
              placeholder="https://company.com"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={loading}
            />
          </label>

          <div className="company-source-fieldset" aria-label="Additional source URLs">
            <div className="company-source-fieldset-header">
              <div>
                <p className="company-source-fieldset-title">Additional source URLs</p>
                <p className="muted">Add public pages to improve enrichment. Optional and limited to the same domain.</p>
              </div>
              <Button
                variant="ghost"
                size="compact"
                onClick={() => setAdditionalUrls((current) => [...current, EMPTY_ADDITIONAL_URL])}
                disabled={loading || !canAddAdditionalUrl}
              >
                Add URL
              </Button>
            </div>

            <div className="company-source-list">
              {additionalUrls.map((value, index) => (
                <div key={`company-additional-url-${index}`} className="company-source-row">
                  <input
                    type="url"
                    name={`additionalSourceUrl-${index}`}
                    placeholder="https://company.com/team"
                    value={value}
                    onChange={(event) =>
                      setAdditionalUrls((current) =>
                        current.map((entry, entryIndex) => (entryIndex === index ? event.target.value : entry)),
                      )
                    }
                    disabled={loading}
                  />
                  <Button
                    variant="ghost"
                    size="compact"
                    onClick={() =>
                      setAdditionalUrls((current) =>
                        current.length === 1 ? [EMPTY_ADDITIONAL_URL] : current.filter((_, entryIndex) => entryIndex !== index),
                      )
                    }
                    disabled={loading || (additionalUrls.length === 1 && !value.trim())}
                    aria-label={`Remove additional source URL ${index + 1}`}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <p className="muted">
            The backend keeps collection bounded: it prioritizes any additional same-domain URLs you provide, then
            uses the usual small set of company pages before enriching and saving the result.
          </p>

          {error ? <p className="error">{error}</p> : null}

          <div className="company-dialog-actions">
            <Button variant="ghost" size="compact" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="compact" disabled={loading}>
              {loading ? 'Ingesting…' : 'Ingest company'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default AddCompanyDialog
