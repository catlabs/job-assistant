import { ArrowRightLeft, Building2, Monitor, type LucideIcon } from 'lucide-react'
import {
  type FinancialSignals,
  getContractTypeLabel,
  getEmploymentTypeLabel,
  getSignalLabel,
  getWorkArrangementLabel,
  type JobBasics,
  type JobCriteriaSkill,
  type PersonalLifeSignals,
  type SkillImportance,
} from './jobs'

export type CompensationSummaryData = {
  amount: string
  sourceLabel: 'Explicit' | 'Estimated'
  sourceDescription: string
  rangeLabel: string
  confidence?: string | null
  basis?: string | null
}

const skillImportanceOrder: Record<SkillImportance, number> = {
  required: 0,
  preferred: 1,
  mentioned: 2,
}

const currencySymbolMap: Record<'EUR' | 'USD' | 'GBP', string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
}

const continentalEuropeCountryKeywords = [
  'austria',
  'belgium',
  'bulgaria',
  'croatia',
  'czech republic',
  'czechia',
  'denmark',
  'estonia',
  'finland',
  'france',
  'germany',
  'greece',
  'hungary',
  'italy',
  'latvia',
  'lithuania',
  'luxembourg',
  'netherlands',
  'norway',
  'poland',
  'portugal',
  'romania',
  'slovakia',
  'slovenia',
  'spain',
  'sweden',
  'switzerland',
]

export const isTextValue = (value?: string | null): value is string => Boolean(value?.trim())

export const isKnownValue = (value?: string | null) => Boolean(value && value !== 'unknown')

export const formatCompactMoney = (value: number) => {
  if (!Number.isFinite(value)) {
    return ''
  }

  if (Math.abs(value) >= 1000) {
    const compactValue = value / 1000
    const rounded = Number.isInteger(compactValue)
      ? String(compactValue)
      : compactValue.toFixed(1).replace(/\.0$/, '')
    return `${rounded}k`
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)
}

const getCompensationCurrencyLabel = (currency: FinancialSignals['salary_currency']) =>
  currency === 'unknown' ? null : (currencySymbolMap[currency] ?? null)

const inferCompensationCurrency = (
  currency: FinancialSignals['salary_currency'],
  location: string,
  country?: string | null,
) => {
  if (currency !== 'unknown') {
    return currency
  }

  const normalizedLocation = `${country ?? ''} ${location}`.toLowerCase()
  const shouldFallbackToEur = continentalEuropeCountryKeywords.some((keyword) =>
    normalizedLocation.includes(keyword),
  )

  return shouldFallbackToEur ? 'EUR' : 'unknown'
}

const getCompensationPeriodLabel = (
  period: FinancialSignals['salary_period'],
  hasDailyRate = false,
) => {
  if (hasDailyRate || period === 'daily') {
    return ' / day'
  }
  if (period === 'yearly') {
    return ' / year'
  }
  if (period === 'monthly') {
    return ' / month'
  }
  if (period === 'hourly') {
    return ' / hour'
  }
  return ''
}

const formatCompensationAmount = (
  low: number | null,
  high: number | null,
  currency: FinancialSignals['salary_currency'],
  period: FinancialSignals['salary_period'],
  hasDailyRate = false,
) => {
  if (low === null && high === null) {
    return null
  }

  const prefix = getCompensationCurrencyLabel(currency)
  if (!prefix) {
    return null
  }

  const suffix = getCompensationPeriodLabel(period, hasDailyRate)

  if (low !== null && high !== null) {
    return `${prefix}${formatCompactMoney(low)}–${prefix}${formatCompactMoney(high)}${suffix}`
  }

  const value = low ?? high
  return value !== null ? `${prefix}${formatCompactMoney(value)}${suffix}` : null
}

export const getCompensationSummary = (
  financial: FinancialSignals,
  location: string,
  country?: string | null,
): CompensationSummaryData | null => {
  const explicitCurrency = inferCompensationCurrency(financial.salary_currency, location, country)
  const explicitDailyRate = formatCompensationAmount(
    financial.daily_rate_min,
    financial.daily_rate_max,
    explicitCurrency,
    financial.salary_period,
    true,
  )

  if (explicitDailyRate) {
    return {
      amount: explicitDailyRate,
      sourceLabel: 'Explicit',
      sourceDescription: 'Stated in posting',
      rangeLabel: explicitDailyRate,
    }
  }

  const explicitSalary = formatCompensationAmount(
    financial.salary_min,
    financial.salary_max,
    explicitCurrency,
    financial.salary_period,
  )

  if (explicitSalary) {
    return {
      amount: explicitSalary,
      sourceLabel: 'Explicit',
      sourceDescription: 'Stated in posting',
      rangeLabel: explicitSalary,
    }
  }

  const estimated = financial.estimated_compensation
  const estimatedCurrency = inferCompensationCurrency(
    estimated.estimated_currency === 'unknown'
      ? financial.salary_currency
      : estimated.estimated_currency,
    location,
    country,
  )
  const estimatedDailyRate = formatCompensationAmount(
    estimated.estimated_daily_rate_min,
    estimated.estimated_daily_rate_max,
    estimatedCurrency,
    financial.salary_period,
    true,
  )

  if (estimatedDailyRate) {
    return {
      amount: estimatedDailyRate,
      sourceLabel: 'Estimated',
      sourceDescription: 'Estimated by system',
      rangeLabel: estimatedDailyRate,
      confidence: isKnownValue(estimated.confidence) ? getSignalLabel(estimated.confidence) : null,
      basis: isTextValue(estimated.basis) ? estimated.basis : null,
    }
  }

  const estimatedSalary = formatCompensationAmount(
    estimated.estimated_salary_min,
    estimated.estimated_salary_max,
    estimatedCurrency,
    financial.salary_period,
  )

  if (estimatedSalary) {
    return {
      amount: estimatedSalary,
      sourceLabel: 'Estimated',
      sourceDescription: 'Estimated by system',
      rangeLabel: estimatedSalary,
      confidence: isKnownValue(estimated.confidence) ? getSignalLabel(estimated.confidence) : null,
      basis: isTextValue(estimated.basis) ? estimated.basis : null,
    }
  }

  return null
}

export const getCompensationListLabel = (
  financial: FinancialSignals,
  location: string,
  country?: string | null,
) => {
  const summary = getCompensationSummary(financial, location, country)

  if (!summary) {
    return null
  }

  return summary.sourceLabel === 'Estimated' ? `${summary.amount} (estimated)` : summary.amount
}

export const getWorkArrangementIcon = (
  workArrangement: PersonalLifeSignals['work_arrangement'],
): LucideIcon | null => {
  if (workArrangement === 'remote') {
    return Monitor
  }

  if (workArrangement === 'hybrid') {
    return ArrowRightLeft
  }

  if (workArrangement === 'onsite') {
    return Building2
  }

  return null
}

export const stripWorkArrangementFromLocation = (
  location: string,
  workArrangement: PersonalLifeSignals['work_arrangement'],
) => {
  const trimmedLocation = location.trim()

  if (!trimmedLocation || workArrangement === 'unknown') {
    return trimmedLocation
  }

  const arrangementLabel = getWorkArrangementLabel(workArrangement)
  const arrangementPattern = new RegExp(
    `\\s*[\\(\\[\\-–—,/]\\s*${arrangementLabel}[\\)\\]]?\\s*$`,
    'i',
  )

  return trimmedLocation.replace(arrangementPattern, '').trim()
}

export const sortTechnicalSignals = (skills: JobCriteriaSkill[]) =>
  skills
    .map((skill, index) => ({ skill, index }))
    .sort((left, right) => {
      const importanceDifference =
        skillImportanceOrder[left.skill.importance] - skillImportanceOrder[right.skill.importance]

      if (importanceDifference !== 0) {
        return importanceDifference
      }

      return left.index - right.index
    })
    .map(({ skill }) => skill)

export const buildSecondaryJobMeta = (basics: JobBasics) =>
  [
    isKnownValue(basics.seniority_level) ? getSignalLabel(basics.seniority_level) : null,
    isKnownValue(basics.employment_type) ? getEmploymentTypeLabel(basics.employment_type) : null,
    isKnownValue(basics.contract_type) ? getContractTypeLabel(basics.contract_type) : null,
  ].filter((value): value is string => Boolean(value))
