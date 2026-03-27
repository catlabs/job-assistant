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

export type LlmCallLog = {
  id: string
  created_at: string
  operation: string
  model?: string | null
  prompt_tokens?: number | null
  completion_tokens?: number | null
  total_tokens?: number | null
  status: 'success' | 'error' | string
  job_id?: string | null
  error_message?: string | null
}

export type LlmCallLogListResponse = {
  count: number
  logs: LlmCallLog[]
}

export class ApiNotFoundError extends Error {}

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

export const fetchJobById = async (
  jobId: string,
  fallbackErrorMessage = 'Could not load this job.',
): Promise<Job> => {
  if (!API_BASE_URL) {
    throw new Error('Missing VITE_API_BASE_URL. Add it to frontend/.env.')
  }

  try {
    const response = await fetch(`${API_BASE_URL}/jobs/${encodeURIComponent(jobId)}`)
    const responseBody = await response.json().catch(() => null)

    if (response.status === 404) {
      throw new ApiNotFoundError('Job not found.')
    }

    if (!response.ok) {
      const apiMessage = getApiErrorMessage(responseBody)
      throw new Error(apiMessage || fallbackErrorMessage)
    }

    return responseBody as Job
  } catch (jobRequestError) {
    if (jobRequestError instanceof ApiNotFoundError) {
      throw jobRequestError
    }

    if (jobRequestError instanceof TypeError) {
      throw new Error('Network error while loading jobs. Please check your connection and try again.')
    }

    if (jobRequestError instanceof Error) {
      throw jobRequestError
    }

    throw new Error(fallbackErrorMessage)
  }
}

export const fetchLlmLogs = async (
  fallbackErrorMessage = 'Could not load LLM usage logs.',
): Promise<LlmCallLogListResponse> => {
  if (!API_BASE_URL) {
    throw new Error('Missing VITE_API_BASE_URL. Add it to frontend/.env.')
  }

  try {
    const response = await fetch(`${API_BASE_URL}/llm-logs/`)
    const responseBody = await response.json().catch(() => null)

    if (!response.ok) {
      const apiMessage = getApiErrorMessage(responseBody)
      throw new Error(apiMessage || fallbackErrorMessage)
    }

    const data = responseBody as LlmCallLogListResponse
    return {
      count: Number.isFinite(data.count) ? data.count : 0,
      logs: Array.isArray(data.logs) ? data.logs : [],
    }
  } catch (logRequestError) {
    if (logRequestError instanceof TypeError) {
      throw new Error('Network error while loading logs. Please check your connection and try again.')
    }

    if (logRequestError instanceof Error) {
      throw logRequestError
    }

    throw new Error(fallbackErrorMessage)
  }
}
