import { FormEvent, useEffect, useState } from 'react'
import Button from './Button'
import { Company, refreshCompanyEnrichment } from '../lib/companies'

const EMPTY_ADDITIONAL_URL = ''
const MAX_ADDITIONAL_URLS = 5

type RefreshCompanyDialogProps = {
  company: Company
  open: boolean
  onClose: () => void
  onUpdated: (company: Company) => void
}

function RefreshCompanyDialog({ company, open, onClose, onUpdated }: RefreshCompanyDialogProps) {
  const [additionalUrls, setAdditionalUrls] = useState<string[]>([EMPTY_ADDITIONAL_URL])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
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

    const nextAdditionalUrls = additionalUrls.map((value) => value.trim()).filter(Boolean)
    if (nextAdditionalUrls.length === 0) {
      setError('Add at least one additional source URL to refresh enrichment.')
      return
    }

    setLoading(true)

    try {
      const updatedCompany = await refreshCompanyEnrichment(company.id, {
        url: company.source_url,
        additional_source_urls: nextAdditionalUrls,
      })
      onUpdated(updatedCompany)
      onClose()
    } catch (refreshError) {
      if (refreshError instanceof Error) {
        setError(refreshError.message)
      } else {
        setError('Could not refresh this company.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return null
  }

  const canAddAdditionalUrl = additionalUrls.length < MAX_ADDITIONAL_URLS

  return (
    <div className="dialog-backdrop" role="presentation" onClick={() => !loading && onClose()}>
      <section
        className="dialog-panel company-dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="refresh-company-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <div>
            <h2 id="refresh-company-title">Add enrichment sources</h2>
            <p className="muted">Add public same-domain pages to refresh this company’s bounded enrichment snapshot.</p>
          </div>
          <Button variant="ghost" size="compact" onClick={onClose} disabled={loading}>
            Close
          </Button>
        </div>

        <form className="dialog-body company-dialog-body" onSubmit={handleSubmit}>
          <label>
            Company URL
            <input type="url" value={company.source_url} disabled readOnly />
          </label>

          <div className="company-source-fieldset" aria-label="Additional source URLs">
            <div className="company-source-fieldset-header">
              <div>
                <p className="company-source-fieldset-title">Additional source URLs</p>
                <p className="muted">Add public pages to improve enrichment. Optional during creation, available here anytime later.</p>
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
                <div key={`refresh-company-url-${index}`} className="company-source-row">
                  <input
                    type="url"
                    name={`refreshAdditionalSourceUrl-${index}`}
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
            Refreshing re-runs the existing bounded collection strategy. It prioritizes the URLs you add here and
            keeps the same page, timeout, size, and text limits.
          </p>

          {error ? <p className="error">{error}</p> : null}

          <div className="company-dialog-actions">
            <Button variant="ghost" size="compact" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="compact" disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh enrichment'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default RefreshCompanyDialog
