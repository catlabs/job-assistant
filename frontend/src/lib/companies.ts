import { apiFetch, getApiBaseUrl, getJsonHeaders } from './api'
import { ApiNotFoundError, getApiErrorMessage, formatCreatedAt } from './jobs'

export type CompanyPage = {
  url: string
  path: string
  status_code?: number | null
  title?: string | null
  text_excerpt?: string | null
  text_length?: number | null
}

export type CompanyEnrichment = {
  summary?: string | null
  product_or_domain_signals?: string[] | null
  hiring_or_team_signals?: string[] | null
  maturity_or_stage_signals?: string[] | null
  risk_flags_or_unknowns?: string[] | null
  source_urls_used?: string[] | null
}

export type Company = {
  id: string
  created_at: string
  updated_at: string
  canonical_url: string
  normalized_host: string
  source_url: string
  ingest_status: 'complete' | 'partial' | 'failed'
  summary?: string | null
  enrichment?: CompanyEnrichment | null
  pages?: CompanyPage[] | null
  content_fingerprint?: string | null
  fetched_at?: string | null
  schema_version?: number | null
}

export type CompanyListResponse = {
  count: number
  companies: Company[]
}

export type CompanyIngestPayload = {
  url: string
  additional_source_urls?: string[]
}

export const fetchCompanies = async (
  fallbackErrorMessage = 'Could not load saved companies.',
): Promise<CompanyListResponse> => {
  getApiBaseUrl()

  try {
    const response = await apiFetch('/companies/')
    const responseBody = await response.json().catch(() => null)

    if (!response.ok) {
      const apiMessage = getApiErrorMessage(responseBody)
      throw new Error(apiMessage || fallbackErrorMessage)
    }

    const data = responseBody as CompanyListResponse
    return {
      count: Number.isFinite(data.count) ? data.count : 0,
      companies: Array.isArray(data.companies) ? data.companies : [],
    }
  } catch (companyRequestError) {
    if (companyRequestError instanceof TypeError) {
      throw new Error('Network error while loading companies. Please check your connection and try again.')
    }

    if (companyRequestError instanceof Error) {
      throw companyRequestError
    }

    throw new Error(fallbackErrorMessage)
  }
}

export const fetchCompanyById = async (
  companyId: string,
  fallbackErrorMessage = 'Could not load this company.',
): Promise<Company> => {
  getApiBaseUrl()

  try {
    const response = await apiFetch(`/companies/${encodeURIComponent(companyId)}`)
    const responseBody = await response.json().catch(() => null)

    if (response.status === 404) {
      throw new ApiNotFoundError('Company not found.')
    }

    if (!response.ok) {
      const apiMessage = getApiErrorMessage(responseBody)
      throw new Error(apiMessage || fallbackErrorMessage)
    }

    return responseBody as Company
  } catch (companyRequestError) {
    if (companyRequestError instanceof ApiNotFoundError) {
      throw companyRequestError
    }

    if (companyRequestError instanceof TypeError) {
      throw new Error('Network error while loading companies. Please check your connection and try again.')
    }

    if (companyRequestError instanceof Error) {
      throw companyRequestError
    }

    throw new Error(fallbackErrorMessage)
  }
}

export const ingestCompany = async (
  payload: CompanyIngestPayload,
  fallbackErrorMessage = 'Could not ingest this company.',
): Promise<Company> => {
  getApiBaseUrl()

  try {
    const response = await apiFetch('/companies/ingest', {
      method: 'POST',
      headers: getJsonHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(payload),
    })
    const responseBody = await response.json().catch(() => null)

    if (response.status !== 201) {
      const apiMessage = getApiErrorMessage(responseBody)
      throw new Error(apiMessage || fallbackErrorMessage)
    }

    return responseBody as Company
  } catch (companySaveError) {
    if (companySaveError instanceof TypeError) {
      throw new Error('Network error while ingesting company. Please check your connection and try again.')
    }

    if (companySaveError instanceof Error) {
      throw companySaveError
    }

    throw new Error(fallbackErrorMessage)
  }
}

export const refreshCompanyEnrichment = async (
  companyId: string,
  payload: CompanyIngestPayload,
  fallbackErrorMessage = 'Could not refresh this company.',
): Promise<Company> => {
  getApiBaseUrl()

  try {
    const response = await apiFetch(`/companies/${encodeURIComponent(companyId)}/refresh`, {
      method: 'POST',
      headers: getJsonHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(payload),
    })
    const responseBody = await response.json().catch(() => null)

    if (!response.ok) {
      const apiMessage = getApiErrorMessage(responseBody)
      throw new Error(apiMessage || fallbackErrorMessage)
    }

    return responseBody as Company
  } catch (companyRefreshError) {
    if (companyRefreshError instanceof TypeError) {
      throw new Error('Network error while refreshing company enrichment. Please check your connection and try again.')
    }

    if (companyRefreshError instanceof Error) {
      throw companyRefreshError
    }

    throw new Error(fallbackErrorMessage)
  }
}

export const formatCompanyTimestamp = (value?: string | null) => formatCreatedAt(value)

export const getCompanyDisplayName = (company: Company) => {
  const titleCandidate = company.pages?.find((page) => page.title?.trim())?.title?.trim()
  if (titleCandidate) {
    return titleCandidate
  }

  return company.normalized_host || company.canonical_url || 'Unknown company'
}
