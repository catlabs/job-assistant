import { getFitBadgeDisplay } from './badges'
import { JobAnalysis } from './jobs'

export type FitFilter = 'all' | 'strong_fit' | 'acceptable_intermediate' | 'misaligned' | 'unassessed'

export const getFitLabel = (fitClassification?: JobAnalysis['fit_classification']) => {
  return getFitBadgeDisplay(fitClassification).label
}

export const getFitBadgeTone = (fitClassification?: JobAnalysis['fit_classification']) => {
  return getFitBadgeDisplay(fitClassification).tone
}
