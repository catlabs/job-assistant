import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageHeader } from '../components/PageHeaderContext'
import { fetchLlmLogs, LlmCallLog } from '../lib/jobs'

const DISPLAY_LOG_LIMIT = 10
const SUMMARY_LOG_LIMIT = 60

const integerFormatter = new Intl.NumberFormat()
const compactNumberFormatter = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const trendDayFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
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

const formatTooltipTokens = (value: number) => `${integerFormatter.format(value)} tokens`

const formatTooltipRequests = (value: number) => `${integerFormatter.format(value)} requests`

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

type DailyTrendPoint = {
  dayKey: string
  label: string
  value: number
}

const toLocalDayKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const buildDailyTrendPoints = (logs: LlmCallLog[], getValue: (log: LlmCallLog) => number): DailyTrendPoint[] => {
  if (logs.length === 0) {
    return []
  }

  const totalsByDay = new Map<string, { date: Date; value: number }>()

  logs.forEach((log) => {
    const timestamp = new Date(log.created_at)
    if (Number.isNaN(timestamp.getTime())) {
      return
    }

    const day = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate())
    const dayKey = toLocalDayKey(day)
    const current = totalsByDay.get(dayKey)

    if (current) {
      current.value += getValue(log)
      return
    }

    totalsByDay.set(dayKey, {
      date: day,
      value: getValue(log),
    })
  })

  return Array.from(totalsByDay.entries())
    .sort((left, right) => left[1].date.getTime() - right[1].date.getTime())
    .map(([dayKey, entry]) => ({
      dayKey,
      label: trendDayFormatter.format(entry.date),
      value: entry.value,
    }))
}

type TrendChartProps = {
  points: DailyTrendPoint[]
  variant: 'area' | 'bars'
  formatTooltipValue: (value: number) => string
}

const getTrendPointX = (index: number, count: number, paddingX: number, chartWidth: number) => {
  if (count <= 1) {
    return paddingX + chartWidth / 2
  }

  return paddingX + (chartWidth / (count - 1)) * index
}

const toTooltipLeft = (x: number, width: number) =>
  `${Math.min(Math.max((x / width) * 100, 14), 86).toFixed(2)}%`

function TrendChart({ points, variant, formatTooltipValue }: TrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const width = 240
  const height = 70
  const paddingX = 4
  const paddingY = 6
  const chartWidth = width - paddingX * 2
  const chartHeight = height - paddingY * 2
  const safePoints = points.length > 0 ? points : [{ dayKey: 'empty', label: '', value: 0 }]
  const maxValue = Math.max(...safePoints.map((point) => point.value), 1)
  const activePoint = hoveredIndex === null ? null : points[hoveredIndex]

  if (variant === 'bars') {
    const slotWidth = chartWidth / safePoints.length
    const barWidth = Math.max(slotWidth - 1.5, 2)
    const barInset = (slotWidth - barWidth) / 2
    const activeX = hoveredIndex === null ? null : paddingX + hoveredIndex * slotWidth + slotWidth / 2
    const tooltipLeft = activeX === null ? null : toTooltipLeft(activeX, width)

    return (
      <div className="metric-chart-shell" onMouseLeave={() => setHoveredIndex(null)}>
        {activePoint && tooltipLeft && (
          <div className="metric-chart-tooltip" style={{ left: tooltipLeft }}>
            <p className="metric-chart-tooltip-date">{activePoint.label}</p>
            <p className="metric-chart-tooltip-value">{formatTooltipValue(activePoint.value)}</p>
          </div>
        )}
        <svg viewBox={`0 0 ${width} ${height}`} className="metric-chart">
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            className="metric-chart-baseline"
          />
          {safePoints.map((point, index) => {
            const normalizedHeight = maxValue === 0 ? 0 : (point.value / maxValue) * chartHeight
            const slotX = paddingX + index * slotWidth
            const x = slotX + barInset
            const y = height - paddingY - normalizedHeight
            const isActive = hoveredIndex === index

            return (
              <g key={`${point.dayKey}-${point.value}`}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(normalizedHeight, 2)}
                  rx={3}
                  className={isActive ? 'metric-chart-bar metric-chart-bar-active' : 'metric-chart-bar'}
                />
                {points[index] && (
                  <rect
                    x={slotX}
                    y={paddingY}
                    width={slotWidth}
                    height={chartHeight}
                    rx={5}
                    className="metric-chart-hit-area"
                    tabIndex={0}
                    aria-label={`${point.label}: ${formatTooltipValue(point.value)}`}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onFocus={() => setHoveredIndex(index)}
                    onBlur={() => setHoveredIndex(null)}
                  />
                )}
              </g>
            )
          })}
        </svg>
      </div>
    )
  }

  const chartPoints = safePoints.map((point, index) => {
    const x = getTrendPointX(index, safePoints.length, paddingX, chartWidth)
    const y = height - paddingY - (point.value / maxValue) * chartHeight
    return { x, y }
  })
  const activeX = hoveredIndex === null ? null : chartPoints[hoveredIndex]?.x ?? null
  const tooltipLeft = activeX === null ? null : toTooltipLeft(activeX, width)
  const linePath = chartPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
  const areaPath = [
    linePath,
    `L ${chartPoints[chartPoints.length - 1].x.toFixed(2)} ${(height - paddingY).toFixed(2)}`,
    `L ${chartPoints[0].x.toFixed(2)} ${(height - paddingY).toFixed(2)}`,
    'Z',
  ].join(' ')

  return (
    <div className="metric-chart-shell" onMouseLeave={() => setHoveredIndex(null)}>
      {activePoint && tooltipLeft && (
        <div className="metric-chart-tooltip" style={{ left: tooltipLeft }}>
          <p className="metric-chart-tooltip-date">{activePoint.label}</p>
          <p className="metric-chart-tooltip-value">{formatTooltipValue(activePoint.value)}</p>
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} className="metric-chart">
        <line
          x1={paddingX}
          y1={height - paddingY}
          x2={width - paddingX}
          y2={height - paddingY}
          className="metric-chart-baseline"
        />
        <path d={areaPath} className="metric-chart-area" />
        {activeX !== null && (
          <line
            x1={activeX}
            y1={paddingY}
            x2={activeX}
            y2={height - paddingY}
            className="metric-chart-guide"
          />
        )}
        <path d={linePath} className="metric-chart-line" />
        {chartPoints.map((point, index) => {
          const isActive = hoveredIndex === index
          const datum = points[index]
          return (
            <g key={`${safePoints[index].dayKey}-${safePoints[index].value}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r={isActive ? 3.8 : 2.6}
                className={isActive ? 'metric-chart-point metric-chart-point-active' : 'metric-chart-point'}
              />
              {datum && (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={9}
                  className="metric-chart-hit-area"
                  tabIndex={0}
                  aria-label={`${datum.label}: ${formatTooltipValue(datum.value)}`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onFocus={() => setHoveredIndex(index)}
                  onBlur={() => setHoveredIndex(null)}
                />
              )}
            </g>
          )
        })}
      </svg>
    </div>
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
      tokenTrend: buildDailyTrendPoints(logs, (log) => getTotalTokens(log) ?? 0),
      requestTrend: buildDailyTrendPoints(logs, () => 1),
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
                  <TrendChart
                    points={summary.tokenTrend}
                    variant="area"
                    formatTooltipValue={formatTooltipTokens}
                  />
                </section>

                <section className="llm-usage-subsection">
                  <p className="llm-usage-metric-title">Total requests</p>
                  <p className="llm-usage-metric-value">{formatMetricValue(summary.totalRequests)}</p>
                  <p className="llm-usage-metric-subtitle">Across {logs.length} recent requests</p>
                  <TrendChart
                    points={summary.requestTrend}
                    variant="bars"
                    formatTooltipValue={formatTooltipRequests}
                  />
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
