import { JobAnalysis } from './jobs'

export type FitFilter = 'all' | 'strong_fit' | 'acceptable_intermediate' | 'misaligned' | 'unassessed'

export const getFitLabel = (fitClassification?: JobAnalysis['fit_classification']) => {
  if (fitClassification === 'strong_fit') {
    return 'Strong fit'
  }
  if (fitClassification === 'acceptable_intermediate') {
    return 'Acceptable / Intermediate'
  }
  if (fitClassification === 'misaligned') {
    return 'Misaligned'
  }
  return 'Unassessed'
}

export const getFitBadgeClass = (fitClassification?: JobAnalysis['fit_classification']) => {
  if (fitClassification === 'strong_fit') {
    return 'fit-badge fit-badge-strong'
  }
  if (fitClassification === 'acceptable_intermediate') {
    return 'fit-badge fit-badge-acceptable'
  }
  if (fitClassification === 'misaligned') {
    return 'fit-badge fit-badge-misaligned'
  }
  return 'fit-badge'
}
