export type JobDecisionV1 = {
  headline: string
  detail: string
  risk_flags: string[]
  clarifying_questions: string[]
}

export type ExtractFieldsResponse = {
  title: string
  company: string
  location: string
  url: string
  source: string
  seniority: string
  summary: string
  keywords: string[]
  raw_text: string
  extraction_ref?: string | null
  fit_classification?: 'strong_fit' | 'acceptable_intermediate' | 'misaligned' | null
  fit_rationale?: string
  decision?: JobDecisionV1 | null
}

export type JobCreatePayload = {
  description: string
  title?: string
  company?: string
  location?: string
  url?: string
  source?: string
  extraction_ref?: string
}

export type JobAnalysis = {
  normalized_title?: string | null
  normalized_company?: string | null
  normalized_location?: string | null
  seniority?: string | null
  keywords?: string[] | null
  summary?: string | null
  fit_classification?: 'strong_fit' | 'acceptable_intermediate' | 'misaligned' | null
  fit_rationale?: string | null
  decision?: JobDecisionV1 | null
}

export type Job = {
  id: string | number
  title: string | null
  company: string | null
  location: string | null
  url?: string | null
  source?: string | null
  description?: string | null
  analysis?: JobAnalysis | null
  created_at?: string | null
}

export type JobListResponse = {
  count: number
  jobs: Job[]
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export const emptyFields: ExtractFieldsResponse = {
  title: '',
  company: '',
  location: '',
  url: '',
  source: '',
  seniority: '',
  summary: '',
  keywords: [],
  raw_text: '',
  extraction_ref: null,
  fit_classification: null,
  fit_rationale: '',
  decision: null,
}

export const getApiErrorMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const detail = (payload as { detail?: unknown }).detail

  if (typeof detail === 'string') {
    return detail
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return ''
        }

        const message = (item as { msg?: unknown }).msg
        return typeof message === 'string' ? message : ''
      })
      .filter(Boolean)

    if (messages.length > 0) {
      return messages.join(', ')
    }
  }

  return null
}

export const formatCreatedAt = (createdAt?: string | null) => {
  if (!createdAt) {
    return 'Unknown date'
  }

  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) {
    return createdAt
  }

  return date.toLocaleString()
}
