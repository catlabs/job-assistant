import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import CompanyDetailView from '../components/CompanyDetailView'
import RefreshCompanyDialog from '../components/RefreshCompanyDialog'
import { usePageHeader } from '../components/PageHeaderContext'
import { ApiNotFoundError } from '../lib/jobs'
import { Company, fetchCompanyById } from '../lib/companies'

function CompanyDetailPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isNotFound, setIsNotFound] = useState(false)
  const [isRefreshDialogOpen, setIsRefreshDialogOpen] = useState(false)

  useEffect(() => {
    if (!companyId?.trim()) {
      setCompany(null)
      setError('')
      setIsNotFound(true)
      return
    }

    const loadCompany = async () => {
      setLoading(true)
      setError('')
      setIsNotFound(false)

      try {
        const nextCompany = await fetchCompanyById(companyId)
        setCompany(nextCompany)
      } catch (companyRequestError) {
        setCompany(null)

        if (companyRequestError instanceof ApiNotFoundError) {
          setIsNotFound(true)
        } else if (companyRequestError instanceof Error) {
          setError(companyRequestError.message)
        } else {
          setError('Could not load this company.')
        }
      } finally {
        setLoading(false)
      }
    }

    void loadCompany()
  }, [companyId])

  const pageHeaderConfig = useMemo(
    () => ({
      title: 'Company details',
      actions: [
        {
          key: 'back',
          label: 'Back to Companies',
          variant: 'ghost' as const,
          to: '/companies',
        },
      ],
    }),
    [],
  )

  usePageHeader(pageHeaderConfig)

  return (
    <div className="content-page content-page-static job-detail-page">
      <div className="content-static-area">
        {(loading || error || isNotFound) && (
          <section className="content-block">
            {loading && <p>Loading company details…</p>}
            {!loading && error && <p className="error">{error}</p>}
            {!loading && !error && isNotFound && <p className="muted">This company could not be found.</p>}
          </section>
        )}

        {!loading && !error && !isNotFound && company ? (
          <section className="job-detail-block">
            <CompanyDetailView company={company} onAddSources={() => setIsRefreshDialogOpen(true)} />
          </section>
        ) : null}
      </div>

      {company ? (
        <RefreshCompanyDialog
          company={company}
          open={isRefreshDialogOpen}
          onClose={() => setIsRefreshDialogOpen(false)}
          onUpdated={(updatedCompany) => setCompany(updatedCompany)}
        />
      ) : null}
    </div>
  )
}

export default CompanyDetailPage
