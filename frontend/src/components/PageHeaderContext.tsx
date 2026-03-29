import { createContext, ReactNode, useContext, useLayoutEffect } from 'react'
import type { ButtonVariant } from './Button'

export type HeaderAction = {
  key: string
  label: string
  onClick?: () => void
  to?: string
  variant?: ButtonVariant
  disabled?: boolean
  className?: string
  icon?: ReactNode
}

export type PageHeaderConfig = {
  title: string
  subtitle?: string
  actions?: HeaderAction[]
}

const defaultConfig: PageHeaderConfig = {
  title: '',
  subtitle: '',
  actions: [],
}

const PageHeaderContext = createContext<((config: PageHeaderConfig) => void) | null>(null)

type PageHeaderProviderProps = {
  children: ReactNode
  value: (config: PageHeaderConfig) => void
}

export function PageHeaderProvider({ children, value }: PageHeaderProviderProps) {
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>
}

export function usePageHeader(config: PageHeaderConfig) {
  const setHeaderConfig = useContext(PageHeaderContext)

  useLayoutEffect(() => {
    if (!setHeaderConfig) {
      return
    }

    setHeaderConfig(config)

    return () => {
      setHeaderConfig(defaultConfig)
    }
  }, [config, setHeaderConfig])
}
