import type { LucideIcon } from 'lucide-react'
import { BadgeCheck, CircleDashed, CircleX } from 'lucide-react'
import { ExtractFieldsResponse, JobAnalysis } from './jobs'

export type BadgeTone = 'neutral' | 'subtle' | 'danger' | 'fit-strong' | 'fit-acceptable' | 'fit-misaligned'

export type FitClassification =
  | ExtractFieldsResponse['fit_classification']
  | JobAnalysis['fit_classification']

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
