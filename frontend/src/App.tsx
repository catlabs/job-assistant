import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import ExtractPage from './pages/ExtractPage'
import JobComparePage from './pages/JobComparePage'
import JobDetailPage from './pages/JobDetailPage'
import JobsPage from './pages/JobsPage'
import LlmLogsPage from './pages/LlmLogsPage'

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="page app-nav-wrap">
          <nav className="app-nav" aria-label="Main navigation">
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
              Extract
            </NavLink>
            <NavLink
              to="/jobs"
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              Saved jobs
            </NavLink>
            <NavLink
              to="/llm-logs"
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              LLM usage
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="page app-main">
        <Routes>
          <Route path="/" element={<ExtractPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/compare" element={<JobComparePage />} />
          <Route path="/jobs/:jobId" element={<JobDetailPage />} />
          <Route path="/llm-logs" element={<LlmLogsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
