import { FitClassification, getFitBadgeDisplay } from '../lib/badges'

type FitIconProps = {
  fitClassification?: FitClassification
  className?: string
}

function FitIcon({ fitClassification, className = '' }: FitIconProps) {
  const fitBadge = getFitBadgeDisplay(fitClassification)
  const Icon = fitBadge.icon

  if (!Icon) {
    return null
  }

  const classes = ['fit-icon', `fit-icon-${fitBadge.tone}`, className].filter(Boolean).join(' ')

  return (
    <span className={classes} role="img" aria-label={fitBadge.label} title={fitBadge.label}>
      <Icon size={15} strokeWidth={2} />
    </span>
  )
}

export default FitIcon
