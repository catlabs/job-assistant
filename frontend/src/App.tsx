import { Briefcase, Building2, FileText, PanelLeftClose, PanelLeftOpen, User } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import Button, { getButtonClassName } from './components/Button'
import { HeaderAction, PageHeaderConfig, PageHeaderProvider } from './components/PageHeaderContext'
import CompanyDetailPage from './pages/CompanyDetailPage'
import CompaniesPage from './pages/CompaniesPage'
import JobComparePage from './pages/JobComparePage'
import JobDetailPage from './pages/JobDetailPage'
import JobsPage from './pages/JobsPage'
import LlmLogsPage from './pages/LlmLogsPage'
import ProfilePage from './pages/ProfilePage'

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [headerConfig, setHeaderConfig] = useState<PageHeaderConfig>({
    title: '',
    subtitle: '',
    actions: [],
  })
  const location = useLocation()
  const isJobsRoute = location.pathname === '/jobs' || location.pathname.startsWith('/jobs/')
  const isCompaniesRoute = location.pathname === '/companies' || location.pathname.startsWith('/companies/')
  const navigationItems = [
    {
      to: '/jobs',
      label: 'Jobs',
      ariaLabel: 'Jobs',
      isActive: isJobsRoute,
      icon: Briefcase,
    },
    {
      to: '/companies',
      label: 'Companies',
      ariaLabel: 'Companies',
      isActive: isCompaniesRoute,
      icon: Building2,
    },
    {
      to: '/llm-logs',
      label: 'LLM usage',
      ariaLabel: 'LLM usage',
      isActive: location.pathname === '/llm-logs',
      icon: FileText,
    },
    {
      to: '/profile',
      label: 'Profile',
      ariaLabel: 'Profile',
      isActive: location.pathname === '/profile',
      icon: User,
    },
  ]

  const renderHeaderAction = (action: HeaderAction) => {
    const actionClassName = ['header-action-button', action.className ?? ''].filter(Boolean).join(' ')
    const linkClassName = getButtonClassName({
      variant: action.variant,
      size: 'compact',
      className: actionClassName,
    })

    if (action.to) {
      return (
        <Link key={action.key} to={action.to} className={linkClassName}>
          {action.icon ? <span className="header-action-icon" aria-hidden="true">{action.icon}</span> : null}
          {action.label}
        </Link>
      )
    }

    return (
      <Button
        key={action.key}
        variant={action.variant}
        size="compact"
        className={actionClassName}
        onClick={action.onClick}
        disabled={action.disabled}
      >
        {action.icon ? <span className="header-action-icon" aria-hidden="true">{action.icon}</span> : null}
        {action.label}
      </Button>
    )
  }

  return (
    <div className={`app-shell ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="app-sidebar">
        <nav className="app-nav" aria-label="Primary">
          {navigationItems.map(({ to, label, ariaLabel, isActive, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={() => `nav-link ${isActive ? 'nav-link-active' : ''}`}
              aria-label={ariaLabel}
            >
              <span className="sidebar-item-icon" aria-hidden="true">
                <Icon className="sidebar-link-icon" size={17} strokeWidth={2} />
              </span>
              <span className="sidebar-link-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-toggle-row">
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isSidebarCollapsed}
            onClick={() => setIsSidebarCollapsed((current) => !current)}
          >
            <span className="sidebar-item-icon" aria-hidden="true">
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="sidebar-link-icon" size={17} strokeWidth={2} />
              ) : (
                <PanelLeftClose className="sidebar-link-icon" size={17} strokeWidth={2} />
              )}
            </span>
          </button>
        </div>
      </aside>

      <main className="app-main">
        <div className="app-main-surface">
          <header className="app-main-header">
            <div className="app-main-header-copy">
              <h1>{headerConfig.title}</h1>
              {headerConfig.subtitle ? <p className="page-subtitle">{headerConfig.subtitle}</p> : null}
            </div>
            {headerConfig.actions && headerConfig.actions.length > 0 ? (
              <div className="app-main-header-actions">{headerConfig.actions.map(renderHeaderAction)}</div>
            ) : null}
          </header>

          <div className="app-route-body">
            <PageHeaderProvider value={setHeaderConfig}>
              <Routes>
                <Route path="/" element={<Navigate to="/jobs" replace />} />
                <Route path="/jobs" element={<JobsPage />} />
                <Route path="/jobs/compare" element={<JobComparePage />} />
                <Route path="/jobs/:jobId" element={<JobDetailPage />} />
                <Route path="/companies" element={<CompaniesPage />} />
                <Route path="/companies/:companyId" element={<CompanyDetailPage />} />
                <Route path="/llm-logs" element={<LlmLogsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="*" element={<Navigate to="/jobs" replace />} />
              </Routes>
            </PageHeaderProvider>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
