import { apiFetch, getApiBaseUrl, getJsonHeaders } from './api'

export type JobDecisionV1 = {
  headline: string
  detail: string
  risk_flags: string[]
  clarifying_questions: string[]
}

export type DecisionAnalysisV2 = {
  compensation_assessment: {
    clarity: 'unknown' | 'partial' | 'clear'
    vs_user_baseline: 'below' | 'in_line' | 'above' | 'unknown'
    summary: string
    caveats?: string | null
  }
  tradeoffs: string[]
  career_positioning: {
    narrative: string
    positioning_tags: string[]
  }
  confidence: 'low' | 'medium' | 'high'
}

export type JobDimensionAssessment = {
  strategic_fit: 'high' | 'medium' | 'low'
  financial_fit: 'upgrade' | 'neutral' | 'downgrade' | 'unknown'
  lifestyle_fit: 'compatible' | 'constrained' | 'incompatible' | 'unknown'
  key_drivers: string[]
  key_tradeoffs: string[]
  key_unknowns: string[]
}

export type WorkArrangement = 'remote' | 'hybrid' | 'onsite' | 'unknown'

export type JobWorkLocationSignals = {
  remote_days_per_week?: number | null
  onsite_days_per_week?: number | null
  work_schedule_detail?: string | null
}

export type ExtractFieldsResponse = {
  title: string
  company: string
  location: string
  url: string
  source: string
  work_arrangement: WorkArrangement
  remote_days_per_week?: number | null
  onsite_days_per_week?: number | null
  work_schedule_detail?: string | null
  compensation_display: string
  seniority: string
  summary: string
  keywords: string[]
  raw_text: string
  extraction_ref?: string | null
  fit_classification?: 'strong_fit' | 'acceptable_intermediate' | 'misaligned' | null
  fit_rationale?: string
  decision?: JobDecisionV1 | null
  dimension_assessment?: JobDimensionAssessment | null
  decision_v2?: DecisionAnalysisV2 | null
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

export type JobAnalysis = JobWorkLocationSignals & {
  normalized_title?: string | null
  normalized_company?: string | null
  normalized_location?: string | null
  work_arrangement?: WorkArrangement | null
  compensation_display?: string | null
  seniority?: string | null
  keywords?: string[] | null
  summary?: string | null
  fit_classification?: 'strong_fit' | 'acceptable_intermediate' | 'misaligned' | null
  fit_rationale?: string | null
  decision?: JobDecisionV1 | null
  dimension_assessment?: JobDimensionAssessment | null
  decision_v2?: DecisionAnalysisV2 | null
}

export type ProfileLocationPreferencesBrussels = {
  max_onsite_days_per_week?: number | null
  notes?: string | null
}

export type ProfileLocationPreferencesNearbyCities = {
  max_onsite_days_per_period?: number | null
  period_weeks?: number | null
  notes?: string | null
}

export type ProfileLocationPreferencesFarLocations = {
  remote_required?: boolean | null
  max_travel_days_per_month?: number | null
  notes?: string | null
}

export type ProfileLocationPreferences = {
  brussels?: ProfileLocationPreferencesBrussels | null
  nearby_cities?: ProfileLocationPreferencesNearbyCities | null
  far_locations?: ProfileLocationPreferencesFarLocations | null
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
  token_cost_usd?: number | null
  status: 'success' | 'error' | string
  job_id?: string | null
  error_message?: string | null
}

export type LlmCallLogListResponse = {
  count: number
  total_count?: number | null
  offset?: number
  logs: LlmCallLog[]
}

export type FetchLlmLogsOptions = {
  limit?: number
  offset?: number
  operation?: string
  status?: 'success' | 'error'
}

export type ProfileJobFitModel = {
  strong_fit_signals: string[]
  acceptable_but_intermediate_signals: string[]
  misaligned_signals: string[]
}

export type ProfileAnalysisPreferences = {
  classification_labels: string[]
  interpretation_rules: string[]
  decision_dimensions: string[]
}

export type ProfileResponse = {
  profile_summary?: string | null
  job_fit_model: ProfileJobFitModel
  analysis_preferences_for_job_assistant: ProfileAnalysisPreferences
  financial_baseline_for_job_assistant?: {
    amount: number
    currency: string
    basis: 'annual_salary' | 'daily_rate' | 'hourly'
    hours_per_week?: number | null
    days_per_year?: number | null
  } | null
  strategic_preferences_for_job_assistant?: {
    risk_tolerance?: 'low' | 'medium' | 'high' | null
    time_horizon?: 'short' | 'mid' | 'long' | null
    career_stage?: string | null
    non_negotiables?: string[]
  } | null
  location_preferences_for_job_assistant?: ProfileLocationPreferences | null
  fit_analysis_enabled: boolean
  explanation?: string | null
}

export type ProfileUpdatePayload = {
  profile_summary?: string | null
  job_fit_model: ProfileJobFitModel
  analysis_preferences_for_job_assistant: ProfileAnalysisPreferences
  financial_baseline_for_job_assistant?: {
    amount: number
    currency: string
    basis: 'annual_salary' | 'daily_rate' | 'hourly'
    hours_per_week?: number | null
    days_per_year?: number | null
  } | null
  strategic_preferences_for_job_assistant?: {
    risk_tolerance?: 'low' | 'medium' | 'high' | null
    time_horizon?: 'short' | 'mid' | 'long' | null
    career_stage?: string | null
    non_negotiables?: string[]
  } | null
  location_preferences_for_job_assistant?: ProfileLocationPreferences | null
}

export type ProfileExplainResponse = {
  enabled: boolean
  message: string
  explanation?: string | null
}

export class ApiNotFoundError extends Error {}

export const emptyFields: ExtractFieldsResponse = {
  title: '',
  company: '',
  location: '',
  url: '',
  source: '',
  work_arrangement: 'unknown',
  compensation_display: '',
  seniority: '',
  summary: '',
  keywords: [],
  raw_text: '',
  extraction_ref: null,
  fit_classification: null,
  fit_rationale: '',
  decision: null,
  dimension_assessment: null,
  decision_v2: null,
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

export const getWorkArrangementLabel = (workArrangement?: WorkArrangement | null) => {
  switch (workArrangement) {
    case 'remote':
      return 'Remote'
    case 'hybrid':
      return 'Hybrid'
    case 'onsite':
      return 'On-site'
    default:
      return 'Unknown arrangement'
  }
}

const formatDaysPerWeek = (count: number, label: string) => `${count} ${label} ${count === 1 ? 'day' : 'days'}/week`

export const getWorkScheduleSummary = (signals?: JobWorkLocationSignals | null) => {
  if (!signals) {
    return null
  }

  const parts: string[] = []

  if (typeof signals.remote_days_per_week === 'number' && Number.isFinite(signals.remote_days_per_week)) {
    parts.push(formatDaysPerWeek(signals.remote_days_per_week, 'remote'))
  }

  if (typeof signals.onsite_days_per_week === 'number' && Number.isFinite(signals.onsite_days_per_week)) {
    parts.push(formatDaysPerWeek(signals.onsite_days_per_week, 'on-site'))
  }

  return parts.length > 0 ? parts.join(' • ') : null
}

export const fetchJobById = async (
  jobId: string,
  fallbackErrorMessage = 'Could not load this job.',
): Promise<Job> => {
  getApiBaseUrl()

  try {
    const response = await apiFetch(`/jobs/${encodeURIComponent(jobId)}`)
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
  options: FetchLlmLogsOptions = {},
  fallbackErrorMessage = 'Could not load LLM usage logs.',
): Promise<LlmCallLogListResponse> => {
  getApiBaseUrl()

  try {
    const params = new URLSearchParams()

    if (typeof options.limit === 'number' && Number.isFinite(options.limit)) {
      params.set('limit', String(Math.max(1, Math.floor(options.limit))))
    }

    if (typeof options.offset === 'number' && Number.isFinite(options.offset)) {
      params.set('offset', String(Math.max(0, Math.floor(options.offset))))
    }

    if (options.operation) {
      params.set('operation', options.operation)
    }

    if (options.status) {
      params.set('status', options.status)
    }

    const query = params.toString()
    const response = await apiFetch(`/llm-logs/${query ? `?${query}` : ''}`)
    const responseBody = await response.json().catch(() => null)

    if (!response.ok) {
      const apiMessage = getApiErrorMessage(responseBody)
      throw new Error(apiMessage || fallbackErrorMessage)
    }

    const data = responseBody as LlmCallLogListResponse
    return {
      count: Number.isFinite(data.count) ? data.count : 0,
      total_count: Number.isFinite(data.total_count) ? data.total_count : null,
      offset: Number.isFinite(data.offset) ? data.offset : 0,
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

export const fetchProfile = async (
  fallbackErrorMessage = 'Could not load profile.',
): Promise<ProfileResponse> => {
  getApiBaseUrl()

  try {
    const response = await apiFetch('/profile/')
    const responseBody = await response.json().catch(() => null)

    if (!response.ok) {
      const apiMessage = getApiErrorMessage(responseBody)
      throw new Error(apiMessage || fallbackErrorMessage)
    }

    return responseBody as ProfileResponse
  } catch (profileRequestError) {
    if (profileRequestError instanceof TypeError) {
      throw new Error('Network error while loading profile. Please check your connection and try again.')
    }

    if (profileRequestError instanceof Error) {
      throw profileRequestError
    }

    throw new Error(fallbackErrorMessage)
  }
}

export const updateProfile = async (
  payload: ProfileUpdatePayload,
  fallbackErrorMessage = 'Could not save profile.',
): Promise<ProfileResponse> => {
  getApiBaseUrl()

  try {
    const response = await apiFetch('/profile/', {
      method: 'PUT',
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

    return responseBody as ProfileResponse
  } catch (profileSaveError) {
    if (profileSaveError instanceof TypeError) {
      throw new Error('Network error while saving profile. Please check your connection and try again.')
    }

    if (profileSaveError instanceof Error) {
      throw profileSaveError
    }

    throw new Error(fallbackErrorMessage)
  }
}

export const explainProfile = async (
  fallbackErrorMessage = 'Could not generate profile explanation.',
): Promise<ProfileExplainResponse> => {
  getApiBaseUrl()

  try {
    const response = await apiFetch('/profile/explain', {
      method: 'POST',
    })
    const responseBody = await response.json().catch(() => null)

    if (!response.ok) {
      const apiMessage = getApiErrorMessage(responseBody)
      throw new Error(apiMessage || fallbackErrorMessage)
    }

    return responseBody as ProfileExplainResponse
  } catch (profileExplainError) {
    if (profileExplainError instanceof TypeError) {
      throw new Error('Network error while requesting explanation. Please check your connection and try again.')
    }

    if (profileExplainError instanceof Error) {
      throw profileExplainError
    }

    throw new Error(fallbackErrorMessage)
  }
}
