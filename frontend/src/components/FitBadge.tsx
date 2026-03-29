import Badge from './Badge'
import { FitClassification, getFitBadgeDisplay } from '../lib/badges'

type FitBadgeProps = {
  fitClassification?: FitClassification
  fallbackLabel?: string
  className?: string
  title?: string
}

function FitBadge({ fitClassification, fallbackLabel, className, title }: FitBadgeProps) {
  const fitBadge = getFitBadgeDisplay(fitClassification, { fallbackLabel })
  const Icon = fitBadge.icon

  return (
    <Badge
      tone={fitBadge.tone}
      className={className}
      title={title}
      icon={Icon ? <Icon size={12} strokeWidth={2} /> : undefined}
    >
      {fitBadge.label}
    </Badge>
  )
}

export default FitBadge
