import { useState, useMemo, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useResourceList } from '#/hooks/use-resource-list'
import {
  usePrometheusStatus,
  useCpuUsageHistory,
  useMemoryUsageHistory,
  useNetworkHistory,
} from '#/hooks/use-prometheus'
import { Breadcrumb } from '#/components/layout/Breadcrumb'
import { Skeleton } from '#/components/ui/skeleton'
import { RefetchIndicator } from '#/components/ui/refetch-indicator'
import { PollingSettings } from '#/components/ui/polling-settings'
import type { PrometheusQueryResponse } from '#/api'

export const Route = createFileRoute('/metrics')({ component: MetricsPage })

type TimeRange = '15m' | '1h' | '6h' | '24h' | '7d'

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
]

const CHART_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#ef4444', '#84cc16', '#f97316', '#6366f1',
]

function formatTimestamp(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatCpuValue(cores: number): string {
  if (cores < 0.01) return `${(cores * 1000).toFixed(0)}m`
  return `${cores.toFixed(2)}`
}

function formatMemoryValue(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MiB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KiB`
  return `${bytes.toFixed(0)} B`
}

function formatNetworkValue(bytesPerSec: number): string {
  if (bytesPerSec >= 1024 ** 2) return `${(bytesPerSec / 1024 ** 2).toFixed(1)} MB/s`
  if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${bytesPerSec.toFixed(0)} B/s`
}

type ChartDataPoint = Record<string, number | string>

function transformPrometheusData(
  response: PrometheusQueryResponse | undefined,
  labelKey: string,
): { data: ChartDataPoint[]; series: string[] } {
  if (!response?.data?.result?.length) return { data: [], series: [] }

  const seriesSet = new Set<string>()
  const timeMap = new Map<number, ChartDataPoint>()

  for (const result of response.data.result) {
    const label = result.metric[labelKey] || result.metric.pod || result.metric.container || result.metric.namespace || 'unknown'
    seriesSet.add(label)

    if (result.values) {
      for (const [ts, val] of result.values) {
        if (!timeMap.has(ts)) {
          timeMap.set(ts, { time: ts })
        }
        timeMap.get(ts)![label] = parseFloat(val)
      }
    }
  }

  const series = Array.from(seriesSet).slice(0, 10)
  const data = Array.from(timeMap.values()).sort((a, b) => (a.time as number) - (b.time as number))
  return { data, series }
}

function MetricsChart({
  title,
  icon,
  data,
  series,
  isLoading,
  isFetching,
  formatValue,
  unit,
}: {
  title: string
  icon: string
  data: ChartDataPoint[]
  series: string[]
  isLoading: boolean
  isFetching?: boolean
  formatValue: (v: number) => string
  unit: string
}) {
  if (isLoading) {
    return (
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-[20px] text-blue-400">{icon}</span>
          <h3 className="font-semibold">{title}</h3>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-[20px] text-blue-400">{icon}</span>
          <h3 className="font-semibold">{title}</h3>
        </div>
        <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
          No data available for this time range
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-[20px] text-blue-400">{icon}</span>
        <h3 className="font-semibold">{title}</h3>
        <RefetchIndicator fetching={isFetching ?? false} />
        <span className="text-xs text-slate-500 ml-auto">{unit}</span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={data}>
            <defs>
              {series.map((s, i) => (
                <linearGradient key={s} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
            <XAxis
              dataKey="time"
              tickFormatter={formatTimestamp}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatValue}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={70}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15,23,42,0.95)',
                border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#e2e8f0',
              }}
              labelFormatter={formatTimestamp}
              formatter={(value: number) => [formatValue(value), '']}
            />
            {series.length <= 8 && (
              <Legend
                wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
              />
            )}
            {series.map((s, i) => (
              <Area
                key={s}
                type="monotone"
                dataKey={s}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                fill={`url(#gradient-${i})`}
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function MetricsPage() {
  const [namespace, setNamespace] = useState<string>('')
  const [pod, setPod] = useState<string>('')
  const [timeRange, setTimeRange] = useState<TimeRange>('1h')

  const { data: promStatus, isLoading: statusLoading } = usePrometheusStatus()
  const available = promStatus?.available ?? false

  const { data: nsData } = useResourceList({
    group: '',
    version: 'v1',
    name: 'namespaces',
    namespaced: false,
  })
  const namespaces = useMemo(() => {
    const items = (nsData as Record<string, unknown>)?.items as Array<{ metadata: { name: string } }> | undefined
    return items?.map((ns) => ns.metadata.name).sort() ?? []
  }, [nsData])

  const { data: podData } = useResourceList({
    group: '',
    version: 'v1',
    name: 'pods',
    namespaced: true,
    namespace: namespace || undefined,
  })
  const pods = useMemo(() => {
    if (!namespace) return []
    const items = (podData as Record<string, unknown>)?.items as Array<{ metadata: { name: string } }> | undefined
    return items?.map((p) => p.metadata.name).sort() ?? []
  }, [podData, namespace])

  const handleNamespaceChange = useCallback((value: string) => {
    setNamespace(value)
    setPod('')
  }, [])

  const cpuQuery = useCpuUsageHistory(
    namespace || undefined,
    pod || undefined,
    timeRange,
    available,
  )

  const memoryQuery = useMemoryUsageHistory(
    namespace || undefined,
    pod || undefined,
    timeRange,
    available,
  )

  const networkQuery = useNetworkHistory(
    namespace || undefined,
    pod || undefined,
    timeRange,
    available,
  )

  const labelKey = pod ? 'container' : namespace ? 'pod' : 'namespace'

  const cpuChart = useMemo(
    () => transformPrometheusData(cpuQuery.data, labelKey),
    [cpuQuery.data, labelKey],
  )

  const memChart = useMemo(
    () => transformPrometheusData(memoryQuery.data, labelKey),
    [memoryQuery.data, labelKey],
  )

  const rxChart = useMemo(
    () => transformPrometheusData(networkQuery.rx.data, 'pod'),
    [networkQuery.rx.data],
  )

  const txChart = useMemo(
    () => transformPrometheusData(networkQuery.tx.data, 'pod'),
    [networkQuery.tx.data],
  )

  if (statusLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: 'Cluster', href: '/' }, { label: 'Metrics' }]} />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!available) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: 'Cluster', href: '/' }, { label: 'Metrics' }]} />
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="size-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px] text-yellow-400">monitoring</span>
          </div>
          <h2 className="text-xl font-bold mb-2">Prometheus Not Available</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md text-sm">
            No Prometheus instance was detected in your cluster. To use the metrics dashboard,
            deploy Prometheus or set the <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-surface-highlight rounded text-xs">KUBERVIEWER_PROMETHEUS_URL</code> environment variable.
          </p>
        </div>
      </div>
    )
  }

  const scopeLabel = pod
    ? `Pod: ${pod}`
    : namespace
      ? `Namespace: ${namespace}`
      : 'Cluster-wide'

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Breadcrumb items={[{ label: 'Cluster', href: '/' }, { label: 'Metrics' }]} />

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Metrics</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Resource usage over time via Prometheus.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PollingSettings />
          <div className="flex items-center gap-1 px-1 py-1 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg">
          {TIME_RANGES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTimeRange(value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                timeRange === value
                  ? 'bg-primary text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 pointer-events-none">
            folder_open
          </span>
          <select
            value={namespace}
            onChange={(e) => handleNamespaceChange(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-surface-light dark:bg-surface-highlight border border-border-light dark:border-border-dark rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none appearance-none"
          >
            <option value="">All Namespaces</option>
            {namespaces.map((ns) => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>
        </div>

        {namespace && (
          <div className="relative flex-1 max-w-xs">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 pointer-events-none">
              deployed_code
            </span>
            <select
              value={pod}
              onChange={(e) => setPod(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-surface-light dark:bg-surface-highlight border border-border-light dark:border-border-dark rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none appearance-none"
            >
              <option value="">All Pods</option>
              {pods.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 ml-auto">
          <span className="material-symbols-outlined text-[16px]">filter_alt</span>
          {scopeLabel}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <MetricsChart
          title="CPU Usage"
          icon="memory"
          data={cpuChart.data}
          series={cpuChart.series}
          isLoading={cpuQuery.isLoading}
          isFetching={cpuQuery.isFetching}
          formatValue={formatCpuValue}
          unit="cores"
        />

        <MetricsChart
          title="Memory Usage"
          icon="bar_chart"
          data={memChart.data}
          series={memChart.series}
          isLoading={memoryQuery.isLoading}
          isFetching={memoryQuery.isFetching}
          formatValue={formatMemoryValue}
          unit="bytes"
        />

        <MetricsChart
          title="Network Receive"
          icon="download"
          data={rxChart.data}
          series={rxChart.series}
          isLoading={networkQuery.rx.isLoading}
          isFetching={networkQuery.rx.isFetching}
          formatValue={formatNetworkValue}
          unit="bytes/sec"
        />

        <MetricsChart
          title="Network Transmit"
          icon="upload"
          data={txChart.data}
          series={txChart.series}
          isLoading={networkQuery.tx.isLoading}
          isFetching={networkQuery.tx.isFetching}
          formatValue={formatNetworkValue}
          unit="bytes/sec"
        />
      </div>
    </div>
  )
}
