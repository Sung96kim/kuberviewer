import { memo } from 'react'
import { Link } from '@tanstack/react-router'
import { relativeTime } from '#/lib/time'

type CronJobSpec = {
  schedule?: string
  suspend?: boolean
  concurrencyPolicy?: string
  successfulJobsHistoryLimit?: number
  failedJobsHistoryLimit?: number
}

type CronJobStatus = {
  lastScheduleTime?: string
  lastSuccessfulTime?: string
  active?: Array<{ name: string }>
}

type CronJobHeaderProps = {
  resource: Record<string, unknown>
  onEditYAML: () => void
}

function to12Hour(hours: number, minutes: number): string {
  const period = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  return `${h}:${String(minutes).padStart(2, '0')} ${period}`
}

function utcToLocalTimeStr(utcHour: string, utcMinute: string): string {
  const d = new Date()
  d.setUTCHours(parseInt(utcHour, 10), parseInt(utcMinute, 10), 0, 0)
  return to12Hour(d.getHours(), d.getMinutes())
}

function describeCron(expression: string): string {
  const parts = expression.trim().split(/\s+/)
  if (parts.length < 5) return expression

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  const hourStr = hour === '*' ? '' : utcToLocalTimeStr(hour, minute)

  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    if (hour === '*' && minute === '*') return 'Every minute'
    if (hour === '*') return `Every hour at minute ${minute}`
    return `At ${hourStr}, every day.`
  }
  if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    return `At ${hourStr}, on selected days of the week.`
  }
  if (month === '*' && dayOfWeek === '*') {
    return `At ${hourStr}, on day ${dayOfMonth} of every month.`
  }
  return expression
}

function parseCronField(field: string): number | null {
  if (field === '*') return null
  if (field.includes('/')) {
    const base = field.split('/')[0]
    return base === '*' ? 0 : parseInt(base, 10)
  }
  if (field.includes(',')) return parseInt(field.split(',')[0], 10)
  if (field.includes('-')) return parseInt(field.split('-')[0], 10)
  const n = parseInt(field, 10)
  return isNaN(n) ? null : n
}

function getIntervalMs(minuteStr: string, hourStr: string): number {
  if (minuteStr.includes('/')) {
    const step = parseInt(minuteStr.split('/')[1], 10)
    if (!isNaN(step) && step > 0) return step * 60 * 1000
  }
  if (hourStr === '*') return 60 * 60 * 1000
  return 24 * 60 * 60 * 1000
}

function getNextRuns(expression: string, count: number): Date[] {
  const parts = expression.trim().split(/\s+/)
  if (parts.length < 5) return []

  const [minuteStr, hourStr] = parts
  const minute = parseCronField(minuteStr) ?? 0
  const hour = parseCronField(hourStr)
  const interval = getIntervalMs(minuteStr, hourStr)

  const runs: Date[] = []
  const now = new Date()

  const start = new Date(now)
  start.setUTCSeconds(0, 0)

  if (hour === null) {
    start.setUTCMinutes(minute)
    if (start <= now) {
      start.setTime(start.getTime() + interval)
    }
  } else {
    start.setUTCHours(hour, minute, 0, 0)
    if (start <= now) {
      start.setTime(start.getTime() + interval)
    }
  }

  if (isNaN(start.getTime())) return []

  for (let i = 0; i < count; i++) {
    runs.push(new Date(start.getTime() + i * interval))
  }

  return runs
}

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone

function formatRunDate(date: Date): string {
  if (isNaN(date.getTime())) return 'Unknown'
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d} ${to12Hour(date.getHours(), date.getMinutes())}`
}

function getRelativeDay(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

const CONCURRENCY_ICONS: Record<string, string> = {
  Forbid: 'block',
  Replace: 'swap_horiz',
}

function getConcurrencyIcon(policy: string): string {
  return CONCURRENCY_ICONS[policy] ?? 'check_circle'
}

const CONCURRENCY_DESCRIPTIONS: Record<string, string> = {
  Forbid: 'Do not allow concurrent runs',
  Replace: 'Replace currently running job',
}

function getConcurrencyDescription(policy: string): string {
  return CONCURRENCY_DESCRIPTIONS[policy] ?? 'Allow concurrent runs'
}

export const CronJobHeader = memo(function CronJobHeader({
  resource,
  onEditYAML,
}: CronJobHeaderProps) {
  const metadata = resource.metadata as { name?: string; namespace?: string; creationTimestamp?: string; labels?: Record<string, string> } | undefined
  const spec = resource.spec as CronJobSpec | undefined
  const status = resource.status as CronJobStatus | undefined

  const schedule = spec?.schedule ?? '* * * * *'
  const isSuspended = spec?.suspend ?? false
  const concurrencyPolicy = spec?.concurrencyPolicy ?? 'Allow'
  const successLimit = spec?.successfulJobsHistoryLimit ?? 3
  const failLimit = spec?.failedJobsHistoryLimit ?? 1
  const cronParts = schedule.trim().split(/\s+/)
  const nextRuns = getNextRuns(schedule, 5)
  const activeJobs = status?.active ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px] text-amber-400">schedule</span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{metadata?.name}</h1>
              {metadata?.labels && Object.entries(metadata.labels).filter(([k]) => !k.includes('kubernetes.io') && !k.includes('helm.sh')).slice(0, 1).map(([, v]) => (
                <span key={v} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                  {v}
                </span>
              ))}
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                isSuspended
                  ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {isSuspended ? 'Suspended' : 'Active'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {metadata?.namespace && (
                <>
                  <Link
                    to="/namespaces/$name"
                    params={{ name: metadata.namespace }}
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">folder_open</span>
                    Namespace: <span className="text-primary font-medium">{metadata.namespace}</span>
                  </Link>
                  <span className="text-slate-500 dark:text-slate-600">·</span>
                </>
              )}
              {metadata?.creationTimestamp && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">schedule</span>
                  Age: {relativeTime(metadata.creationTimestamp)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onEditYAML}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:bg-slate-50 dark:hover:bg-surface-hover transition-colors text-sm font-medium"
          >
            <span className="material-symbols-outlined text-[16px]">description</span>
            Edit YAML
          </button>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors text-sm font-medium"
            title="Trigger a manual job run"
          >
            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
            Trigger Now
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400">calendar_today</span>
            <h3 className="text-base font-bold">Schedule Configuration</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <span className="text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold block mb-2">Cron Expression</span>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1">
                  {cronParts.slice(0, 5).map((part, i) => (
                    <span key={i} className="inline-flex items-center justify-center min-w-[28px] h-8 px-1.5 rounded bg-slate-100 dark:bg-surface-highlight border border-border-light dark:border-border-dark text-sm font-mono font-bold">
                      {part}
                    </span>
                  ))}
                </div>
                <span className={`material-symbols-outlined text-[20px] ${isSuspended ? 'text-yellow-400' : 'text-emerald-400'}`}>
                  {isSuspended ? 'pause_circle' : 'check_circle'}
                </span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {describeCron(schedule)}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-500 mt-0.5">Shown in: {LOCAL_TZ}</p>
            </div>

            <div>
              <span className="text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold block mb-2">Next Scheduled Runs</span>
              <div className="space-y-1.5">
                {nextRuns.map((run, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="text-slate-500 dark:text-slate-400 w-20 shrink-0">{getRelativeDay(run)}</span>
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{formatRunDate(run)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border-light dark:border-border-dark flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-500">
              Last successful schedule time: {status?.lastSuccessfulTime ? `${relativeTime(status.lastSuccessfulTime)} ago` : 'Never'}
            </span>
            {activeJobs.length > 0 && (
              <span className="text-blue-400 text-xs font-medium">{activeJobs.length} active job(s)</span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-5">
            <span className="text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold block mb-3">Concurrency Policy</span>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[24px] text-slate-500 dark:text-slate-400">{getConcurrencyIcon(concurrencyPolicy)}</span>
              <div>
                <p className="text-base font-bold">{concurrencyPolicy}</p>
                <p className="text-xs text-slate-600 dark:text-slate-500">{getConcurrencyDescription(concurrencyPolicy)}</p>
              </div>
            </div>
          </div>

          <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-5">
            <span className="text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold block mb-3">History Limits</span>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold">{successLimit}</p>
                <p className="text-xs text-slate-600 dark:text-slate-500">Successful Jobs</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{failLimit}</p>
                <p className="text-xs text-slate-600 dark:text-slate-500">Failed Jobs</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
