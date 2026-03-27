import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchLlmLogs, formatCreatedAt, LlmCallLog } from '../lib/jobs'

const formatTokens = (log: LlmCallLog) => {
  if (typeof log.total_tokens === 'number') {
    return String(log.total_tokens)
  }

  const prompt = typeof log.prompt_tokens === 'number' ? log.prompt_tokens : '-'
  const completion = typeof log.completion_tokens === 'number' ? log.completion_tokens : '-'
  const total = typeof log.total_tokens === 'number' ? log.total_tokens : '-'
  return `${prompt}/${completion}/${total}`
}

function LlmLogsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<LlmCallLog[]>([])
  const [count, setCount] = useState(0)

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true)
      setError('')

      try {
        const data = await fetchLlmLogs()
        setLogs(data.logs)
        setCount(data.count)
      } catch (logsRequestError) {
        setLogs([])
        setCount(0)

        if (logsRequestError instanceof Error) {
          setError(logsRequestError.message)
        } else {
          setError('Could not load LLM usage logs.')
        }
      } finally {
        setLoading(false)
      }
    }

    void loadLogs()
  }, [])

  return (
    <>
      <section className="page-heading">
        <h1>LLM Usage</h1>
        <p className="page-subtitle">Showing latest {count} LLM call logs.</p>
      </section>

      <section className="panel">
        {loading && <p>Loading logs…</p>}
        {!loading && error && <p className="error">{error}</p>}
        {!loading && !error && logs.length === 0 && <p className="muted">No logs yet.</p>}
        {!loading && !error && logs.length > 0 && (
          <table className="compare-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Operation</th>
                <th>Model</th>
                <th>Tokens</th>
                <th>Status</th>
                <th>Linked job</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatCreatedAt(log.created_at)}</td>
                  <td>{log.operation}</td>
                  <td>{log.model || '—'}</td>
                  <td>{formatTokens(log)}</td>
                  <td>
                    {log.status}
                    {log.error_message ? ` (${log.error_message})` : ''}
                  </td>
                  <td>{log.job_id ? <Link to={`/jobs/${log.job_id}`}>{log.job_id}</Link> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}

export default LlmLogsPage
