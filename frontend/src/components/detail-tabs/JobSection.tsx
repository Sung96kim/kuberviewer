import { memo } from 'react'
import { relativeTime } from '#/lib/time'

type JobSectionProps = {
  resource: Record<string, unknown>
}

export const JobSection = memo(function JobSection({ resource }: JobSectionProps) {
  const spec = (resource.spec ?? {}) as Record<string, unknown>
  const status = (resource.status ?? {}) as Record<string, unknown>

  const completions = spec.completions as number | undefined
  const parallelism = (spec.parallelism ?? 1) as number
  const backoffLimit = (spec.backoffLimit ?? 6) as number
  const activeDeadlineSeconds = spec.activeDeadlineSeconds as number | undefined
  const ttlAfterFinished = spec.ttlSecondsAfterFinished as number | undefined

  const active = (status.active ?? 0) as number
  const succeeded = (status.succeeded ?? 0) as number
  const failed = (status.failed ?? 0) as number
  const startTime = status.startTime as string | undefined
  const completionTime = status.completionTime as string | undefined

  const conditions = (status.conditions ?? []) as Array<{
    type: string
    status: string
    lastTransitionTime?: string
    reason?: string
    message?: string
  }>

  const isComplete = conditions.some((c) => c.type === 'Complete' && c.status === 'True')
  const isFailed = conditions.some((c) => c.type === 'Failed' && c.status === 'True')

  let duration = ''
  if (startTime) {
    const start = new Date(startTime)
    const end = completionTime ? new Date(completionTime) : new Date()
    const diffMs = end.getTime() - start.getTime()
    if (!isNaN(diffMs)) {
      const seconds = Math.floor(diffMs / 1000)
      if (seconds < 60) duration = `${seconds}s`
      else if (seconds < 3600) duration = `${Math.floor(seconds / 60)}m ${seconds % 60}s`
      else duration = `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">
          <h3 className="text-base font-bold">Status</h3>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
            isComplete
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : isFailed
                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {isComplete ? 'Complete' : isFailed ? 'Failed' : 'Running'}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 divide-x divide-border-light dark:divide-border-dark">
          {[
            { label: 'Active', value: active, color: active > 0 ? 'text-blue-400' : undefined },
            { label: 'Succeeded', value: succeeded, color: succeeded > 0 ? 'text-emerald-500' : undefined },
            { label: 'Failed', value: failed, color: failed > 0 ? 'text-red-400' : undefined },
            { label: 'Completions', value: completions !== undefined ? `${succeeded}/${completions}` : `${succeeded}` },
          ].map(({ label, value, color }) => (
            <div key={label} className="px-4 py-4 text-center">
              <p className={`text-2xl font-bold ${color ?? 'text-slate-900 dark:text-white'}`}>
                {value}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
          <h3 className="text-base font-bold">Configuration</h3>
        </div>
        <div className="px-6">
          <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
            <span className="text-sm text-slate-500 dark:text-slate-400">Parallelism</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white">{parallelism}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
            <span className="text-sm text-slate-500 dark:text-slate-400">Backoff Limit</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white">{backoffLimit}</span>
          </div>
          {completions !== undefined && (
            <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
              <span className="text-sm text-slate-500 dark:text-slate-400">Completions</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{completions}</span>
            </div>
          )}
          {activeDeadlineSeconds !== undefined && (
            <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
              <span className="text-sm text-slate-500 dark:text-slate-400">Active Deadline</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{activeDeadlineSeconds}s</span>
            </div>
          )}
          {ttlAfterFinished !== undefined && (
            <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
              <span className="text-sm text-slate-500 dark:text-slate-400">TTL After Finished</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{ttlAfterFinished}s</span>
            </div>
          )}
          {startTime && (
            <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
              <span className="text-sm text-slate-500 dark:text-slate-400">Started</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{relativeTime(startTime)} ago</span>
            </div>
          )}
          {duration && (
            <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
              <span className="text-sm text-slate-500 dark:text-slate-400">Duration</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{duration}</span>
            </div>
          )}
        </div>
      </div>

      {conditions.length > 0 && (
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
            <h3 className="text-base font-bold">Conditions</h3>
          </div>
          <div className="divide-y divide-border-light dark:divide-border-dark">
            {conditions.map((c) => {
              const isTrue = c.status === 'True'
              return (
                <div key={c.type} className="px-6 py-4 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded ${isTrue ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 dark:bg-surface-highlight text-slate-400'}`}>
                      <span className="material-symbols-outlined text-[20px]">{isTrue ? 'check_circle' : 'cancel'}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{c.type}</p>
                      {c.message && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.message}</p>}
                    </div>
                  </div>
                  {c.lastTransitionTime && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">{relativeTime(c.lastTransitionTime)} ago</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
})
