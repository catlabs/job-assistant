import type { LucideIcon } from 'lucide-react'
import { BadgeCheck, CircleDashed, CircleX } from 'lucide-react'
import { ExtractFieldsResponse, JobAnalysis, JobDimensionAssessment } from './jobs'

export type BadgeTone = 'neutral' | 'subtle' | 'danger' | 'fit-strong' | 'fit-acceptable' | 'fit-misaligned'

export type FitClassification =
  | ExtractFieldsResponse['fit_classification']
  | JobAnalysis['fit_classification']

export type StrategicFit = JobDimensionAssessment['strategic_fit']
export type FinancialFit = JobDimensionAssessment['financial_fit']
export type LifestyleFit = JobDimensionAssessment['lifestyle_fit']

type FitBadgeDisplayOptions = {
  fallbackLabel?: string
}

export const getFitBadgeDisplay = (
  fitClassification?: FitClassification,
  options: FitBadgeDisplayOptions = {},
): { label: string; tone: BadgeTone; icon?: LucideIcon } => {
  if (fitClassification === 'strong_fit') {
    return { label: 'Strong fit', tone: 'fit-strong', icon: BadgeCheck }
  }

  if (fitClassification === 'acceptable_intermediate') {
    return { label: 'Acceptable / Intermediate', tone: 'fit-acceptable', icon: CircleDashed }
  }

  if (fitClassification === 'misaligned') {
    return { label: 'Misaligned', tone: 'fit-misaligned', icon: CircleX }
  }

  return {
    label: options.fallbackLabel ?? 'Unassessed',
    tone: 'subtle',
  }
}

export const getStrategicFitDisplay = (
  value?: StrategicFit,
): { label: string; tone: BadgeTone } => {
  if (value === 'high') {
    return { label: 'High', tone: 'fit-strong' }
  }

  if (value === 'medium') {
    return { label: 'Medium', tone: 'fit-acceptable' }
  }

  if (value === 'low') {
    return { label: 'Low', tone: 'fit-misaligned' }
  }

  return { label: 'Unknown', tone: 'subtle' }
}

export const getFinancialFitDisplay = (
  value?: FinancialFit,
): { label: string; tone: BadgeTone } => {
  if (value === 'upgrade') {
    return { label: 'Upgrade', tone: 'fit-strong' }
  }

  if (value === 'neutral') {
    return { label: 'Neutral', tone: 'subtle' }
  }

  if (value === 'downgrade') {
    return { label: 'Downgrade', tone: 'fit-misaligned' }
  }

  return { label: 'Unknown', tone: 'subtle' }
}

export const getLifestyleFitDisplay = (
  value?: LifestyleFit,
): { label: string; tone: BadgeTone } => {
  if (value === 'compatible') {
    return { label: 'Compatible', tone: 'fit-strong' }
  }

  if (value === 'constrained') {
    return { label: 'Constrained', tone: 'fit-acceptable' }
  }

  if (value === 'incompatible') {
    return { label: 'Incompatible', tone: 'fit-misaligned' }
  }

  return { label: 'Unknown', tone: 'subtle' }
}
