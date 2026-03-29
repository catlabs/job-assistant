import { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'ghost'
export type ButtonSize = 'default' | 'compact' | 'icon'

type ButtonClassNameOptions = {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

// Use Button for standard actions. Use getButtonClassName for Link-like actions that should
// share the same styling. Keep layout chrome and role-specific controls separate, even when
// they borrow the shared button base for spacing, focus, or disabled treatment.
export function getButtonClassName({
  variant = 'primary',
  size = 'default',
  className = '',
}: ButtonClassNameOptions = {}) {
  return ['app-button', `app-button-${variant}`, size !== 'default' ? `app-button-${size}` : '', className]
    .filter(Boolean)
    .join(' ')
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

function Button({ variant = 'primary', size = 'default', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={getButtonClassName({ variant, size, className })}
      {...props}
    />
  )
}

export default Button
