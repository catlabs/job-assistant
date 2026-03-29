import type { ReactNode } from 'react'
import { BadgeTone } from '../lib/badges'

type BadgeProps = {
  children: ReactNode
  tone?: BadgeTone
  className?: string
  title?: string
  icon?: ReactNode
}

function Badge({ children, tone = 'neutral', className = '', title, icon }: BadgeProps) {
  const classes = ['badge', `badge-${tone}`, className].filter(Boolean).join(' ')

  return (
    <span className={classes} title={title}>
      {icon ? (
        <span className="badge-content">
          <span className="badge-icon" aria-hidden="true">
            {icon}
          </span>
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </span>
  )
}

export default Badge
