import { memo, useMemo, useState } from 'react'
import { useResourceList } from '#/hooks/use-resource-list'
import { relativeTime } from '#/lib/time'

type CronJobScheduleTabProps = {
  namespace: string
  cronJobName: string
  resource: Record<string, unknown>
}

type KubeItem = Record<string, unknown>

type JobEntry = {
  name: string
  started: string
  completed: string
  duration: string
  status: 'Complete' | 'Failed' | 'Running' | 'Unknown'
  completionTime: string
}

type FilterStatus = 'all' | 'Complete' | 'Failed' | 'Running'

const PAGE_SIZE = 10

const STATUS_STYLES: Record<string, string> = {
  Complete: 'bg-emerald-500/10 text-emerald-400',
  Failed: 'bg-red-500/10 text-red-400',
  Running: 'bg-blue-500/10 text-blue-400',
  Unknown: 'bg-slate-500/10 text-slate-400',
}

const STATUS_ICONS: Record<string, string> = {
  Complete: 'check_circle',
  Failed: 'cancel',
  Running: 'pending',
  Unknown: 'help',
}

export const CronJobScheduleTab = memo(function CronJobScheduleTab({
  namespace,
  cronJobName,
}: CronJobScheduleTabProps) {
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [page, setPage] = useState(0)

  const { data, isLoading } = useResourceList({
    group: 'batch',
    version: 'v1',
    name: 'jobs',
    namespaced: true,
    namespace,
  })

  const items: KubeItem[] = (data as { items?: KubeItem[] })?.items ?? []

  const jobs: JobEntry[] = useMemo(() => {
    return items
      .filter((item) => {
        const ownerRefs = ((item.metadata as Record<string, unknown>)?.ownerReferences as Array<{ name: string; kind: string }>) ?? []
        return ownerRefs.some((ref) => ref.kind === 'CronJob' && ref.name === cronJobName)
      })
      .map((item) => {
        const meta = item.metadata as { name?: string; creationTimestamp?: string } | undefined
        const jobStatus = item.status as {
          startTime?: string
          completionTime?: string
          succeeded?: number
          failed?: number
          active?: number
          conditions?: Array<{ type: string; status: string }>
        } | undefined
        const isComplete = jobStatus?.conditions?.some((c) => c.type === 'Complete' && c.status === 'True') ?? false
        const isFailed = jobStatus?.conditions?.some((c) => c.type === 'Failed' && c.status === 'True') ?? false
        const status: JobEntry['status'] = isComplete ? 'Complete' : isFailed ? 'Failed' : (jobStatus?.active ?? 0) > 0 ? 'Running' : 'Unknown'
        return {
          name: meta?.name ?? '',
          started: meta?.creationTimestamp ? relativeTime(meta.creationTimestamp) + ' ago' : '-',
          completed: jobStatus?.completionTime ? relativeTime(jobStatus.completionTime) + ' ago' : '-',
          duration: jobStatus?.startTime && jobStatus?.completionTime
            ? formatDuration(new Date(jobStatus.completionTime).getTime() - new Date(jobStatus.startTime).getTime())
            : '-',
          status,
          completionTime: jobStatus?.completionTime ?? meta?.creationTimestamp ?? '',
        }
      })
      .sort((a, b) => b.name.localeCompare(a.name))
  }, [items, cronJobName])

  const filtered = useMemo(() => {
    if (filter === 'all') return jobs
    return jobs.filter((j) => j.status === filter)
  }, [jobs, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const statusCounts = useMemo(() => {
    const counts = { Complete: 0, Failed: 0, Running: 0 }
    for (const j of jobs) {
      if (j.status in counts) counts[j.status as keyof typeof counts]++
    }
    return counts
  }, [jobs])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400">history</span>
          <h3 className="text-base font-bold">Job History</h3>
          <span className="text-xs text-slate-600 dark:text-slate-500 ml-1">({jobs.length} total)</span>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'Complete', 'Failed', 'Running'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setFilter(s); setPage(0) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === s
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                  : 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {s === 'all' ? 'All' : s}
              {s !== 'all' && (
                <span className="ml-1.5 text-slate-500">{statusCounts[s]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
        {isLoading ? (
          <div className="px-6 py-12 text-center">
            <span className="material-symbols-outlined text-[32px] text-slate-600 animate-spin">progress_activity</span>
            <p className="text-sm text-slate-500 mt-2">Loading job history...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <span className="material-symbols-outlined text-[32px] text-slate-600">work_off</span>
            <p className="text-sm text-slate-500 mt-2">
              {filter === 'all' ? 'No jobs have been created yet' : `No ${filter.toLowerCase()} jobs found`}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-light dark:border-border-dark">
                  <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold">Job Name</th>
                  <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold">Status</th>
                  <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold">Duration</th>
                  <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold">Completion Time</th>
                  <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {paged.map((job) => (
                  <tr key={job.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <span className="font-medium text-blue-400 hover:text-blue-300 cursor-pointer">{job.name}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[job.status]}`}>
                        <span className="material-symbols-outlined text-[14px]">{STATUS_ICONS[job.status]}</span>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{job.duration}</td>
                    <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">{job.completed}</td>
                    <td className="px-5 py-3">
                      <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                        <span className="material-symbols-outlined text-[16px]">more_vert</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-border-light dark:border-border-dark flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-500">
                  Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      className={`min-w-[28px] h-7 rounded text-xs font-medium transition-colors ${
                        page === i ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page === totalPages - 1}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
})

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}
