import { PencilLine } from 'lucide-react'
import type { ReactNode } from 'react'
import Badge from './Badge'
import { getButtonClassName } from './Button'
import { Company, formatCompanyTimestamp, getCompanyDisplayName } from '../lib/companies'

type CompanyDetailViewProps = {
  company: Company
  onAddSources?: () => void
}

type CompanyListBlockProps = {
  title: string
  items: string[]
  emptyMessage: string
}

type CompanyFactProps = {
  label: string
  value: ReactNode
}

function CompanyListBlock({ title, items, emptyMessage }: CompanyListBlockProps) {
  return (
    <div className="job-detail-list-block">
      <h4 className="job-detail-list-title">{title}</h4>
      {items.length > 0 ? (
        <ul className="decision-list">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">{emptyMessage}</p>
      )}
    </div>
  )
}

function CompanyFact({ label, value }: CompanyFactProps) {
  return (
    <div className="job-detail-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function getStatusTone(status: Company['ingest_status']) {
  if (status === 'failed') {
    return 'danger' as const
  }
  if (status === 'partial') {
    return 'neutral' as const
  }
  return 'subtle' as const
}

function getStatusLabel(status: Company['ingest_status']) {
  if (status === 'failed') {
    return 'Ingest failed'
  }
  if (status === 'partial') {
    return 'Partial context'
  }
  return 'Complete'
}

function getReadableSourceLabel(sourceUrl: string) {
  try {
    const parsed = new URL(sourceUrl)
    const path = parsed.pathname === '/' ? '' : parsed.pathname
    return `${parsed.hostname}${path}`
  } catch {
    return sourceUrl
  }
}

const enrichmentSourcesActionClassName = getButtonClassName({
  variant: 'ghost',
  size: 'icon',
  className: 'company-detail-edit-toggle',
})

function CompanyDetailView({ company, onAddSources }: CompanyDetailViewProps) {
  const enrichment = company.enrichment
  const pages = company.pages ?? []
  const metadataSummary = getCompanyDisplayName(company)
  const sourceUrls = enrichment?.source_urls_used ?? []

  return (
    <div className="job-detail-dashboard company-detail-dashboard">
      <div className="job-detail-column job-detail-column-scroll">
        <section className="job-detail-subsection job-detail-subsection-hero">
          <div className="job-detail-hero-header">
            <div className="job-detail-hero-copy">
              <h2 className="job-detail-title">{company.normalized_host}</h2>
              <p className="job-detail-primary-meta">
                <span>{metadataSummary}</span>
                <span className="job-detail-meta-separator" aria-hidden="true">
                  •
                </span>
                <span>{company.canonical_url}</span>
              </p>
            </div>

            <Badge tone={getStatusTone(company.ingest_status)}>{getStatusLabel(company.ingest_status)}</Badge>
          </div>

          <div className="badge-list job-detail-meta-inline">
            <Badge tone="subtle">Fetched: {formatCompanyTimestamp(company.fetched_at)}</Badge>
            <Badge tone="subtle">Updated: {formatCompanyTimestamp(company.updated_at)}</Badge>
            <Badge tone="subtle">Pages: {pages.length}</Badge>
          </div>

          <div className="job-detail-link-row">
            <a href={company.canonical_url} target="_blank" rel="noreferrer">
              Open company site
            </a>
          </div>
        </section>

        <section className="job-detail-subsection">
          <h3 className="profile-section-title">Summary</h3>
          {company.summary?.trim() ? (
            <div className="profile-display-copy">{company.summary}</div>
          ) : (
            <p className="muted">No summary is available for this company yet.</p>
          )}
        </section>

        <section className="job-detail-subsection">
          <h3 className="profile-section-title">Structured signals</h3>
          <div className="job-detail-stack">
            <CompanyListBlock
              title="Product or domain"
              items={enrichment?.product_or_domain_signals ?? []}
              emptyMessage="No product or domain signals extracted."
            />
            <CompanyListBlock
              title="Hiring or team"
              items={enrichment?.hiring_or_team_signals ?? []}
              emptyMessage="No hiring or team signals extracted."
            />
            <CompanyListBlock
              title="Maturity or stage"
              items={enrichment?.maturity_or_stage_signals ?? []}
              emptyMessage="No maturity or stage signals extracted."
            />
          </div>
        </section>

        <section className="job-detail-subsection">
          <h3 className="profile-section-title">Risk flags and unknowns</h3>
          <CompanyListBlock
            title="Uncertainty"
            items={enrichment?.risk_flags_or_unknowns ?? []}
            emptyMessage="No risk flags or unknowns were called out."
          />
        </section>
      </div>

      <div className="job-detail-column job-detail-column-right job-detail-column-scroll">
        <section className="job-detail-subsection">
          <div className="profile-section-header profile-section-header-editable">
            <h3 className="profile-section-title">Enrichment sources</h3>
            {onAddSources ? (
              <button
                type="button"
                className={enrichmentSourcesActionClassName}
                onClick={onAddSources}
                aria-label="Add source URLs"
                title="Add source URLs"
              >
                <PencilLine size={14} />
              </button>
            ) : null}
          </div>

          <div className="company-source-summary">
            <p>
              Enrichment used a bounded set of public same-domain pages from the company site, including any
              additional URLs provided during ingest.
            </p>
            <dl className="job-detail-facts company-source-facts">
              <CompanyFact label="Pages collected" value={pages.length} />
              <CompanyFact label="Sources recorded" value={sourceUrls.length} />
              <CompanyFact label="Last fetched" value={formatCompanyTimestamp(company.fetched_at)} />
            </dl>
          </div>

          {sourceUrls.length > 0 ? (
            <div className="company-source-url-list">
              {sourceUrls.map((sourceUrl) => (
                <div key={sourceUrl} className="company-source-url-item">
                  <a href={sourceUrl} target="_blank" rel="noreferrer" className="company-source-url-link">
                    {getReadableSourceLabel(sourceUrl)}
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No enrichment source URLs were recorded for this company.</p>
          )}
        </section>

        <section className="job-detail-subsection">
          <h3 className="profile-section-title">Company metadata</h3>
          <dl className="job-detail-facts">
            <CompanyFact
              label="Website"
              value={
                <a href={company.canonical_url} target="_blank" rel="noreferrer">
                  {company.canonical_url}
                </a>
              }
            />
            <CompanyFact label="Entry URL" value={company.source_url} />
            <CompanyFact label="Context status" value={getStatusLabel(company.ingest_status)} />
            <CompanyFact label="Fetched" value={formatCompanyTimestamp(company.fetched_at)} />
            <CompanyFact label="Updated" value={formatCompanyTimestamp(company.updated_at)} />
          </dl>
        </section>
      </div>
    </div>
  )
}

export default CompanyDetailView
