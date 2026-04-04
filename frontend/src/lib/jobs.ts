import { apiFetch, getApiBaseUrl, getJsonHeaders } from './api'

export type EmploymentType = 'full_time' | 'freelance' | 'contract' | 'part_time' | 'unknown'
export type ContractType = 'employee' | 'freelance' | 'consulting' | 'fixed_term' | 'unknown'
export type SeniorityLevel = 'junior' | 'mid' | 'senior' | 'lead' | 'staff' | 'principal' | 'unknown'
export type WorkArrangement = 'remote' | 'hybrid' | 'onsite' | 'unknown'
export type ScheduleFlexibilitySignal = 'high' | 'medium' | 'low' | 'unknown'
export type SalaryCurrency = 'EUR' | 'USD' | 'GBP' | 'unknown'
export type SalaryPeriod = 'yearly' | 'monthly' | 'daily' | 'hourly' | 'unknown'
export type SignalStrength = 'high' | 'medium' | 'low' | 'unknown'
export type DeliveryScopeSignal =
  | 'full_stack'
  | 'backend_only'
  | 'frontend_only'
  | 'platform'
  | 'cross_functional'
  | 'unknown'
export type ConfidenceLevel = 'high' | 'medium' | 'low'
export type SkillCategory =
  | 'programming_language'
  | 'framework'
  | 'backend'
  | 'frontend'
  | 'ai_data'
  | 'cloud_infra'
  | 'devops'
  | 'testing_quality'
  | 'data_storage'
  | 'delivery_tool'
  | 'architecture_practice'
export type SkillImportance = 'required' | 'preferred' | 'mentioned'

export type JobCriteriaSkill = {
  name: string
  category: SkillCategory
  importance: SkillImportance
}

export type SignalEvidence = {
  quotes: string[]
  rationale?: string | null
}

export type JobBasics = {
  title: string
  company_name: string
  location_text: string
  country: string
  city: string
  employment_type: EmploymentType
  contract_type: ContractType
  seniority_level: SeniorityLevel
  job_summary: string
  title_evidence: SignalEvidence
  company_name_evidence: SignalEvidence
  location_text_evidence: SignalEvidence
  employment_type_evidence: SignalEvidence
  contract_type_evidence: SignalEvidence
  seniority_level_evidence: SignalEvidence
  job_summary_evidence: SignalEvidence
}

export type TechnicalSignals = {
  skills: JobCriteriaSkill[]
  technical_notes: string
  technical_notes_evidence: SignalEvidence
}

export type PersonalLifeSignals = {
  work_arrangement: WorkArrangement
  onsite_days_per_week: number | null
  fully_remote: boolean | null
  fully_onsite: boolean | null
  travel_required: boolean | null
  travel_percentage: number | null
  relocation_required: boolean | null
  schedule_flexibility_signal: ScheduleFlexibilitySignal
  personal_life_notes: string
  work_arrangement_evidence: SignalEvidence
  onsite_days_per_week_evidence: SignalEvidence
  fully_remote_evidence: SignalEvidence
  fully_onsite_evidence: SignalEvidence
  travel_required_evidence: SignalEvidence
  travel_percentage_evidence: SignalEvidence
  relocation_required_evidence: SignalEvidence
  schedule_flexibility_signal_evidence: SignalEvidence
  personal_life_notes_evidence: SignalEvidence
}

export type FinancialSignals = {
  estimated_compensation: {
    estimated_salary_min: number | null
    estimated_salary_max: number | null
    estimated_daily_rate_min: number | null
    estimated_daily_rate_max: number | null
    estimated_currency: SalaryCurrency
    confidence: 'high' | 'medium' | 'low' | 'unknown'
    basis: string
  }
  salary_min: number | null
  salary_max: number | null
  salary_currency: SalaryCurrency
  salary_period: SalaryPeriod
  daily_rate_min: number | null
  daily_rate_max: number | null
  bonus_mentioned: boolean | null
  equity_mentioned: boolean | null
  financial_clarity: 'high' | 'medium' | 'low'
  financial_notes: string
  salary_min_evidence: SignalEvidence
  salary_max_evidence: SignalEvidence
  salary_currency_evidence: SignalEvidence
  salary_period_evidence: SignalEvidence
  daily_rate_min_evidence: SignalEvidence
  daily_rate_max_evidence: SignalEvidence
  bonus_mentioned_evidence: SignalEvidence
  equity_mentioned_evidence: SignalEvidence
  financial_clarity_evidence: SignalEvidence
  financial_notes_evidence: SignalEvidence
}

export type StrategicSignals = {
  ai_exposure_signal: SignalStrength
  product_ownership_signal: SignalStrength
  delivery_scope_signal: DeliveryScopeSignal
  learning_potential_signal: SignalStrength
  market_value_signal: SignalStrength
  building_role: boolean | null
  annotation_or_evaluation_only: boolean | null
  strategic_notes: string
  ai_exposure_signal_evidence: SignalEvidence
  product_ownership_signal_evidence: SignalEvidence
  delivery_scope_signal_evidence: SignalEvidence
  learning_potential_signal_evidence: SignalEvidence
  market_value_signal_evidence: SignalEvidence
  building_role_evidence: SignalEvidence
  annotation_or_evaluation_only_evidence: SignalEvidence
  strategic_notes_evidence: SignalEvidence
}

export type ExtractionQuality = {
  confidence_level: ConfidenceLevel
  missing_critical_information: string[]
  ambiguity_notes: string
}

export type JobCriteria = {
  job_basics: JobBasics
  technical_signals: TechnicalSignals
  personal_life_signals: PersonalLifeSignals
  financial_signals: FinancialSignals
  strategic_signals: StrategicSignals
  extraction_quality: ExtractionQuality
}

export type ExtractFieldsResponse = {
  raw_text: string
  criteria: JobCriteria
}

export type CompensationEstimationStatus = 'completed' | 'skipped' | 'failed'

export type EstimateCompensationResponse = {
  status: CompensationEstimationStatus
  estimated_compensation: FinancialSignals['estimated_compensation']
  reason?: string | null
}

export type JobCreatePayload = {
  description: string
  title?: string
  company?: string
  location?: string
  url?: string
  source?: string
  criteria?: JobCriteria
}

export type Job = {
  id: string | number
  title: string | null
  company: string | null
  location: string | null
  url?: string | null
  source?: string | null
  description?: string | null
  criteria: JobCriteria
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

export const emptyCriteria: JobCriteria = {
  job_basics: {
    title: '',
    company_name: '',
    location_text: '',
    country: '',
    city: '',
    employment_type: 'unknown',
    contract_type: 'unknown',
    seniority_level: 'unknown',
    job_summary: '',
    title_evidence: { quotes: [], rationale: null },
    company_name_evidence: { quotes: [], rationale: null },
    location_text_evidence: { quotes: [], rationale: null },
    employment_type_evidence: { quotes: [], rationale: null },
    contract_type_evidence: { quotes: [], rationale: null },
    seniority_level_evidence: { quotes: [], rationale: null },
    job_summary_evidence: { quotes: [], rationale: null },
  },
  technical_signals: {
    skills: [],
    technical_notes: '',
    technical_notes_evidence: { quotes: [], rationale: null },
  },
  personal_life_signals: {
    work_arrangement: 'unknown',
    onsite_days_per_week: null,
    fully_remote: null,
    fully_onsite: null,
    travel_required: null,
    travel_percentage: null,
    relocation_required: null,
    schedule_flexibility_signal: 'unknown',
    personal_life_notes: '',
    work_arrangement_evidence: { quotes: [], rationale: null },
    onsite_days_per_week_evidence: { quotes: [], rationale: null },
    fully_remote_evidence: { quotes: [], rationale: null },
    fully_onsite_evidence: { quotes: [], rationale: null },
    travel_required_evidence: { quotes: [], rationale: null },
    travel_percentage_evidence: { quotes: [], rationale: null },
    relocation_required_evidence: { quotes: [], rationale: null },
    schedule_flexibility_signal_evidence: { quotes: [], rationale: null },
    personal_life_notes_evidence: { quotes: [], rationale: null },
  },
  financial_signals: {
    estimated_compensation: {
      estimated_salary_min: null,
      estimated_salary_max: null,
      estimated_daily_rate_min: null,
      estimated_daily_rate_max: null,
      estimated_currency: 'unknown',
      confidence: 'unknown',
      basis: '',
    },
    salary_min: null,
    salary_max: null,
    salary_currency: 'unknown',
    salary_period: 'unknown',
    daily_rate_min: null,
    daily_rate_max: null,
    bonus_mentioned: null,
    equity_mentioned: null,
    financial_clarity: 'low',
    financial_notes: '',
    salary_min_evidence: { quotes: [], rationale: null },
    salary_max_evidence: { quotes: [], rationale: null },
    salary_currency_evidence: { quotes: [], rationale: null },
    salary_period_evidence: { quotes: [], rationale: null },
    daily_rate_min_evidence: { quotes: [], rationale: null },
    daily_rate_max_evidence: { quotes: [], rationale: null },
    bonus_mentioned_evidence: { quotes: [], rationale: null },
    equity_mentioned_evidence: { quotes: [], rationale: null },
    financial_clarity_evidence: { quotes: [], rationale: null },
    financial_notes_evidence: { quotes: [], rationale: null },
  },
  strategic_signals: {
    ai_exposure_signal: 'unknown',
    product_ownership_signal: 'unknown',
    delivery_scope_signal: 'unknown',
    learning_potential_signal: 'unknown',
    market_value_signal: 'unknown',
    building_role: null,
    annotation_or_evaluation_only: null,
    strategic_notes: '',
    ai_exposure_signal_evidence: { quotes: [], rationale: null },
    product_ownership_signal_evidence: { quotes: [], rationale: null },
    delivery_scope_signal_evidence: { quotes: [], rationale: null },
    learning_potential_signal_evidence: { quotes: [], rationale: null },
    market_value_signal_evidence: { quotes: [], rationale: null },
    building_role_evidence: { quotes: [], rationale: null },
    annotation_or_evaluation_only_evidence: { quotes: [], rationale: null },
    strategic_notes_evidence: { quotes: [], rationale: null },
  },
  extraction_quality: {
    confidence_level: 'low',
    missing_critical_information: [],
    ambiguity_notes: '',
  },
}

export const emptyFields: ExtractFieldsResponse = {
  raw_text: '',
  criteria: emptyCriteria,
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

export const getEmploymentTypeLabel = (employmentType?: EmploymentType | null) => {
  switch (employmentType) {
    case 'full_time':
      return 'Full-time'
    case 'freelance':
      return 'Freelance'
    case 'contract':
      return 'Contract'
    case 'part_time':
      return 'Part-time'
    default:
      return 'Unknown'
  }
}

export const getContractTypeLabel = (contractType?: ContractType | null) => {
  switch (contractType) {
    case 'employee':
      return 'Employee'
    case 'freelance':
      return 'Freelance'
    case 'consulting':
      return 'Consulting'
    case 'fixed_term':
      return 'Fixed-term'
    default:
      return 'Unknown'
  }
}

export const getSignalLabel = (value?: string | null) => {
  if (!value || value === 'unknown') {
    return 'Unknown'
  }

  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export const formatBoolean = (value?: boolean | null) => {
  if (value === null || value === undefined) {
    return null
  }

  return value ? 'Yes' : 'No'
}

export const formatEnum = (value?: string | null) => {
  if (!value || value === 'unknown') {
    return null
  }

  return getSignalLabel(value)
}

export const getWorkScheduleSummary = (
  signals?: JobCriteria['personal_life_signals'] | null,
) => {
  if (!signals || typeof signals.onsite_days_per_week !== 'number' || !Number.isFinite(signals.onsite_days_per_week)) {
    return null
  }

  const count = signals.onsite_days_per_week
  return `${count} on-site ${count === 1 ? 'day' : 'days'}/week`
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)

const formatCompensationRange = (
  low: number | null,
  high: number | null,
  currency: string,
  suffix: string,
) => {
  if (low !== null && high !== null) {
    return `${currency}${formatMoney(low)} - ${currency}${formatMoney(high)}${suffix}`
  }
  if (low !== null) {
    return `${currency}${formatMoney(low)}${suffix}`
  }
  return null
}

export const formatCompensationSummary = (financial: JobCriteria['financial_signals']) => {
  const explicitCurrency = financial.salary_currency === 'unknown' ? '' : `${financial.salary_currency} `
  const periodLabel =
    financial.salary_period === 'yearly'
      ? ' / year'
      : financial.salary_period === 'monthly'
        ? ' / month'
        : financial.salary_period === 'hourly'
          ? ' / hour'
          : ''

  const explicitDailyRate = formatCompensationRange(financial.daily_rate_min, financial.daily_rate_max, explicitCurrency, ' / day')
  if (explicitDailyRate) {
    return explicitDailyRate
  }

  const explicitSalary = formatCompensationRange(financial.salary_min, financial.salary_max, explicitCurrency, periodLabel)
  if (explicitSalary) {
    return explicitSalary
  }

  const estimated = financial.estimated_compensation
  const estimatedCurrency = estimated.estimated_currency === 'unknown' ? '' : `${estimated.estimated_currency} `
  const estimatedDailyRate = formatCompensationRange(
    estimated.estimated_daily_rate_min,
    estimated.estimated_daily_rate_max,
    estimatedCurrency,
    ' / day',
  )
  if (estimatedDailyRate) {
    return `Estimated: ${estimatedDailyRate}`
  }

  const estimatedSalary = formatCompensationRange(
    estimated.estimated_salary_min,
    estimated.estimated_salary_max,
    estimatedCurrency,
    periodLabel,
  )
  if (estimatedSalary) {
    return `Estimated: ${estimatedSalary}`
  }

  return financial.financial_notes || 'Not specified'
}

export const extractJobFields = async (
  rawText: string,
  model?: string,
  fallbackErrorMessage = 'Could not analyze this job. Please try again with more complete text.',
): Promise<ExtractFieldsResponse> => {
  getApiBaseUrl()

  try {
    const requestBody: { raw_text: string; model?: string } = { raw_text: rawText }
    if (model) {
      requestBody.model = model
    }

    const response = await apiFetch('/jobs/extract-fields', {
      method: 'POST',
      headers: getJsonHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(requestBody),
    })
    const responseBody = await response.json().catch(() => null)

    if (!response.ok) {
      if (response.status === 504) {
        throw new Error('Extraction timed out. Please retry with shorter text or try again.')
      }
      const apiMessage = getApiErrorMessage(responseBody)
      throw new Error(apiMessage || fallbackErrorMessage)
    }

    return { ...emptyFields, ...(responseBody as ExtractFieldsResponse) }
  } catch (extractError) {
    if (extractError instanceof TypeError) {
      throw new Error('Network error while extracting fields. Please check your connection and try again.')
    }
    if (extractError instanceof Error) {
      throw extractError
    }
    throw new Error(fallbackErrorMessage)
  }
}

export const estimateCompensation = async (
  rawText: string,
  criteria: JobCriteria,
  model?: string,
  fallbackErrorMessage = 'Compensation estimation is currently unavailable.',
): Promise<EstimateCompensationResponse> => {
  getApiBaseUrl()

  try {
    const requestBody: { raw_text: string; criteria: JobCriteria; model?: string } = {
      raw_text: rawText,
      criteria,
    }
    if (model) {
      requestBody.model = model
    }

    const response = await apiFetch('/jobs/estimate-compensation', {
      method: 'POST',
      headers: getJsonHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(requestBody),
    })
    const responseBody = await response.json().catch(() => null)

    if (!response.ok) {
      if (response.status === 504) {
        throw new Error('Compensation estimation timed out. You can continue with extracted criteria.')
      }
      const apiMessage = getApiErrorMessage(responseBody)
      throw new Error(apiMessage || fallbackErrorMessage)
    }

    const parsed = responseBody as Partial<EstimateCompensationResponse> | null
    return {
      status: parsed?.status === 'completed' || parsed?.status === 'skipped' || parsed?.status === 'failed' ? parsed.status : 'failed',
      estimated_compensation: {
        ...emptyCriteria.financial_signals.estimated_compensation,
        ...(parsed?.estimated_compensation ?? {}),
      },
      reason: typeof parsed?.reason === 'string' ? parsed.reason : null,
    }
  } catch (estimateError) {
    if (estimateError instanceof TypeError) {
      throw new Error('Network error while estimating compensation. Please check your connection and try again.')
    }
    if (estimateError instanceof Error) {
      throw estimateError
    }
    throw new Error(fallbackErrorMessage)
  }
}

export const createJob = async (
  payload: JobCreatePayload,
  fallbackErrorMessage = 'Could not save this job posting.',
): Promise<Job> => {
  getApiBaseUrl()

  try {
    const response = await apiFetch('/jobs/', {
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

    return responseBody as Job
  } catch (jobCreateError) {
    if (jobCreateError instanceof TypeError) {
      throw new Error('Network error while saving. Please check your connection and try again.')
    }

    if (jobCreateError instanceof Error) {
      throw jobCreateError
    }

    throw new Error(fallbackErrorMessage)
  }
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
