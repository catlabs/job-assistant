import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageHeader } from '../components/PageHeaderContext'
import { fetchLlmLogs, LlmCallLog } from '../lib/jobs'

const DISPLAY_LOG_LIMIT = 10
const SUMMARY_LOG_LIMIT = 60
const TREND_BUCKET_COUNT = 8

const integerFormatter = new Intl.NumberFormat()
const compactNumberFormatter = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const logDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const getTotalTokens = (log: LlmCallLog) => {
  if (typeof log.total_tokens === 'number' && Number.isFinite(log.total_tokens)) {
    return log.total_tokens
  }

  const promptTokens =
    typeof log.prompt_tokens === 'number' && Number.isFinite(log.prompt_tokens) ? log.prompt_tokens : null
  const completionTokens =
    typeof log.completion_tokens === 'number' && Number.isFinite(log.completion_tokens)
      ? log.completion_tokens
      : null

  if (promptTokens === null && completionTokens === null) {
    return null
  }

  return (promptTokens ?? 0) + (completionTokens ?? 0)
}

const formatTokenCount = (value: number | null) => {
  if (value === null) {
    return '—'
  }

  return integerFormatter.format(value)
}

const formatTokens = (log: LlmCallLog) => formatTokenCount(getTotalTokens(log))

const formatMetricValue = (value: number) => {
  if (value < 1000) {
    return integerFormatter.format(value)
  }

  return compactNumberFormatter.format(value)
}

const formatCost = (log: LlmCallLog) => {
  if (typeof log.token_cost_usd !== 'number' || !Number.isFinite(log.token_cost_usd)) {
    return '—'
  }

  return `$${log.token_cost_usd.toFixed(6)}`
}

const formatCompactDate = (createdAt?: string | null) => {
  if (!createdAt) {
    return 'Unknown date'
  }

  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) {
    return createdAt
  }

  return logDateFormatter.format(date)
}

const buildTrendValues = (logs: LlmCallLog[], getValue: (log: LlmCallLog) => number) => {
  const buckets = Array.from({ length: TREND_BUCKET_COUNT }, () => 0)

  if (logs.length === 0) {
    return buckets
  }

  const datedLogs = logs
    .map((log) => {
      const timestamp = new Date(log.created_at).getTime()
      return {
        log,
        timestamp: Number.isFinite(timestamp) ? timestamp : null,
      }
    })
    .sort((left, right) => {
      const leftTimestamp = left.timestamp ?? 0
      const rightTimestamp = right.timestamp ?? 0
      return leftTimestamp - rightTimestamp
    })

  const validTimestamps = datedLogs.map((entry) => entry.timestamp).filter((value): value is number => value !== null)

  if (validTimestamps.length >= 2) {
    const firstTimestamp = validTimestamps[0]
    const lastTimestamp = validTimestamps[validTimestamps.length - 1]

    if (lastTimestamp === firstTimestamp) {
      datedLogs.forEach(({ log }, index) => {
        const bucketIndex = Math.min(
          TREND_BUCKET_COUNT - 1,
          Math.floor((index / Math.max(datedLogs.length, 1)) * TREND_BUCKET_COUNT),
        )
        buckets[bucketIndex] += getValue(log)
      })

      return buckets
    }

    const range = lastTimestamp - firstTimestamp

    datedLogs.forEach(({ log, timestamp }) => {
      const resolvedTimestamp = timestamp ?? firstTimestamp
      const progress = Math.min(Math.max((resolvedTimestamp - firstTimestamp) / range, 0), 1)
      const bucketIndex = Math.min(TREND_BUCKET_COUNT - 1, Math.floor(progress * TREND_BUCKET_COUNT))
      buckets[bucketIndex] += getValue(log)
    })

    return buckets
  }

  datedLogs.forEach(({ log }, index) => {
    const bucketIndex = Math.min(
      TREND_BUCKET_COUNT - 1,
      Math.floor((index / Math.max(datedLogs.length, 1)) * TREND_BUCKET_COUNT),
    )
    buckets[bucketIndex] += getValue(log)
  })

  return buckets
}

type TrendChartProps = {
  values: number[]
  variant: 'area' | 'bars'
}

function TrendChart({ values, variant }: TrendChartProps) {
  const width = 240
  const height = 70
  const paddingX = 4
  const paddingY = 6
  const chartWidth = width - paddingX * 2
  const chartHeight = height - paddingY * 2
  const safeValues = values.length > 0 ? values : [0]
  const maxValue = Math.max(...safeValues, 1)

  if (variant === 'bars') {
    const barGap = 6
    const barWidth = Math.max((chartWidth - barGap * (safeValues.length - 1)) / safeValues.length, 6)

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="metric-chart" aria-hidden="true">
        <line
          x1={paddingX}
          y1={height - paddingY}
          x2={width - paddingX}
          y2={height - paddingY}
          className="metric-chart-baseline"
        />
        {safeValues.map((value, index) => {
          const normalizedHeight = maxValue === 0 ? 0 : (value / maxValue) * chartHeight
          const x = paddingX + index * (barWidth + barGap)
          const y = height - paddingY - normalizedHeight
          return (
            <rect
              key={`${index}-${value}`}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(normalizedHeight, 2)}
              rx={3}
              className="metric-chart-bar"
            />
          )
        })}
      </svg>
    )
  }

  const step = safeValues.length > 1 ? chartWidth / (safeValues.length - 1) : chartWidth
  const points = safeValues.map((value, index) => {
    const x = paddingX + step * index
    const y = height - paddingY - (value / maxValue) * chartHeight
    return { x, y }
  })
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
  const areaPath = [
    linePath,
    `L ${points[points.length - 1].x.toFixed(2)} ${(height - paddingY).toFixed(2)}`,
    `L ${points[0].x.toFixed(2)} ${(height - paddingY).toFixed(2)}`,
    'Z',
  ].join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="metric-chart" aria-hidden="true">
      <line
        x1={paddingX}
        y1={height - paddingY}
        x2={width - paddingX}
        y2={height - paddingY}
        className="metric-chart-baseline"
      />
      <path d={areaPath} className="metric-chart-area" />
      <path d={linePath} className="metric-chart-line" />
    </svg>
  )
}

function LlmLogsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<LlmCallLog[]>([])

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true)
      setError('')

      try {
        const data = await fetchLlmLogs({ limit: SUMMARY_LOG_LIMIT })
        setLogs(data.logs)
      } catch (logsRequestError) {
        setLogs([])

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

  const recentLogs = useMemo(() => logs.slice(0, DISPLAY_LOG_LIMIT), [logs])

  const summary = useMemo(() => {
    const totalTokens = logs.reduce((sum, log) => sum + (getTotalTokens(log) ?? 0), 0)
    const totalRequests = logs.length

    return {
      totalTokens,
      totalRequests,
      tokenTrend: buildTrendValues(logs, (log) => getTotalTokens(log) ?? 0),
      requestTrend: buildTrendValues(logs, () => 1),
    }
  }, [logs])

  const pageHeaderConfig = useMemo(() => {
    if (logs.length === 0) {
      return {
        title: 'LLM usage',
        subtitle: 'Recent LLM request logs and lightweight usage totals.',
      }
    }

    return {
      title: 'LLM usage',
      subtitle: `Summary across ${logs.length} recent calls, with the latest ${recentLogs.length} entries shown.`,
    }
  }, [logs.length, recentLogs.length])

  usePageHeader(pageHeaderConfig)

  return (
    <div className="content-page">
      <div className="content-scroll-area">
        <section className="content-block">
          {loading && (
            <section className="llm-usage-subsection">
              <p>Loading logs…</p>
            </section>
          )}
          {!loading && error && (
            <section className="llm-usage-subsection">
              <p className="error">{error}</p>
            </section>
          )}
          {!loading && !error && logs.length === 0 && (
            <section className="llm-usage-subsection">
              <p className="muted">No logs yet.</p>
            </section>
          )}
          {!loading && !error && logs.length > 0 && (
            <div className="llm-usage-layout">
              <section className="llm-usage-column">
                <section className="llm-usage-subsection">
                  <div className="llm-usage-section-heading">
                    <div>
                      <h2>Recent logs</h2>
                      <p className="muted">Latest {recentLogs.length} entries.</p>
                    </div>
                  </div>
                  <div className="llm-logs-table-wrap">
                    <table className="compare-table llm-logs-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Operation</th>
                          <th>Model</th>
                          <th>Tokens</th>
                          <th>Cost</th>
                          <th>Status</th>
                          <th>Job</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentLogs.map((log) => {
                          const statusClassName =
                            log.status === 'error' ? 'llm-log-status llm-log-status-error' : 'llm-log-status'

                          return (
                            <tr key={log.id}>
                              <td className="llm-log-time">{formatCompactDate(log.created_at)}</td>
                              <td>{log.operation}</td>
                              <td className="llm-log-model">{log.model || '—'}</td>
                              <td>{formatTokens(log)}</td>
                              <td>{formatCost(log)}</td>
                              <td>
                                <span className={statusClassName} title={log.error_message || undefined}>
                                  {log.status}
                                </span>
                              </td>
                              <td>
                                {log.job_id ? (
                                  <Link
                                    to={`/jobs/${log.job_id}`}
                                    className="compact-job-link"
                                    title={`Open job ${log.job_id}`}
                                    aria-label={`Open related job ${log.job_id}`}
                                  >
                                    Job
                                  </Link>
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </section>

              <aside className="llm-usage-sidebar llm-usage-column-right">
                <div className="llm-usage-section-heading llm-usage-sidebar-heading">
                  <div>
                    <h2>Usage summary</h2>
                    <p className="muted">Simple totals across the recent log window.</p>
                  </div>
                </div>

                <section className="llm-usage-subsection">
                  <p className="llm-usage-metric-title">Total tokens</p>
                  <p className="llm-usage-metric-value">{formatMetricValue(summary.totalTokens)}</p>
                  <p className="llm-usage-metric-subtitle">Across {logs.length} recent requests</p>
                  <TrendChart values={summary.tokenTrend} variant="area" />
                </section>

                <section className="llm-usage-subsection">
                  <p className="llm-usage-metric-title">Total requests</p>
                  <p className="llm-usage-metric-value">{formatMetricValue(summary.totalRequests)}</p>
                  <p className="llm-usage-metric-subtitle">Across {logs.length} recent requests</p>
                  <TrendChart values={summary.requestTrend} variant="bars" />
                </section>
              </aside>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default LlmLogsPage
