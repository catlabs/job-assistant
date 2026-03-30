import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AddCompanyDialog from '../components/AddCompanyDialog'
import Badge from '../components/Badge'
import { usePageHeader } from '../components/PageHeaderContext'
import { Company, fetchCompanies, formatCompanyTimestamp, getCompanyDisplayName } from '../lib/companies'

function getStatusTone(status: Company['ingest_status']) {
  if (status === 'failed') {
    return 'danger' as const
  }
  if (status === 'partial') {
    return 'neutral' as const
  }
  return 'subtle' as const
}

function CompaniesPage() {
  const navigate = useNavigate()
  const [companiesLoading, setCompaniesLoading] = useState(false)
  const [companiesError, setCompaniesError] = useState('')
  const [companies, setCompanies] = useState<Company[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  useEffect(() => {
    const loadCompanies = async () => {
      setCompaniesLoading(true)
      setCompaniesError('')

      try {
        const response = await fetchCompanies()
        setCompanies(response.companies)
      } catch (companyRequestError) {
        if (companyRequestError instanceof Error) {
          setCompaniesError(companyRequestError.message)
        } else {
          setCompaniesError('Could not load saved companies.')
        }
        setCompanies([])
      } finally {
        setCompaniesLoading(false)
      }
    }

    void loadCompanies()
  }, [])

  const pageHeaderConfig = useMemo(
    () => ({
      title: 'Companies',
      actions: [
        {
          key: 'add-company',
          label: 'Add company',
          onClick: () => setIsAddDialogOpen(true),
        },
      ],
    }),
    [],
  )

  usePageHeader(pageHeaderConfig)

  return (
    <div className="content-page">
      <div className="content-scroll-area">
        <section className="content-block">
          <section className="panel">
            {companiesLoading && <p>Loading saved companies…</p>}
            {companiesError && <p className="error">{companiesError}</p>}
            {!companiesLoading && !companiesError && companies.length === 0 ? (
              <div className="companies-empty-state">
                <p className="muted">No companies saved yet.</p>
                <p className="muted">Add a company URL to collect a bounded site snapshot and enrichment summary.</p>
              </div>
            ) : null}

            {!companiesLoading && !companiesError && companies.length > 0 ? (
              <>
                <div className="companies-list-header">
                  <p className="jobs-list-count">
                    {companies.length} compan{companies.length === 1 ? 'y' : 'ies'}
                  </p>
                </div>

                <ul className="companies-list">
                  {companies.map((company) => (
                    <li
                      key={company.id}
                      className="company-item"
                      onClick={() => navigate(`/companies/${company.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          navigate(`/companies/${company.id}`)
                        }
                      }}
                      role="link"
                      tabIndex={0}
                    >
                      <div className="company-item-main">
                        <div className="company-item-topline">
                          <p className="company-item-host">{company.normalized_host}</p>
                          <Badge tone={getStatusTone(company.ingest_status)}>{company.ingest_status}</Badge>
                        </div>
                        <p className="company-item-identity">{getCompanyDisplayName(company)}</p>
                        <p className="company-item-summary">{company.summary || 'No summary available yet.'}</p>
                      </div>

                      <dl className="company-item-meta">
                        <div>
                          <dt>Fetched</dt>
                          <dd>{formatCompanyTimestamp(company.fetched_at)}</dd>
                        </div>
                        <div>
                          <dt>Updated</dt>
                          <dd>{formatCompanyTimestamp(company.updated_at)}</dd>
                        </div>
                        <div>
                          <dt>Pages</dt>
                          <dd>{company.pages?.length ?? 0}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        </section>
      </div>

      <AddCompanyDialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onCreated={(companyId) => navigate(`/companies/${companyId}`)}
      />
    </div>
  )
}

export default CompaniesPage
