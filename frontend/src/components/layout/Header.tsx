import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useContexts, useSwitchContext } from '#/hooks/use-contexts'
import { useTheme } from '#/hooks/use-theme'
import { usePollingInterval } from '#/hooks/use-polling'
import { api } from '#/api'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'

const STATUS_COLORS = {
  ok: 'text-emerald-500',
  warn: 'text-yellow-500',
  error: 'text-red-500',
} as const

const STATUS_BG = {
  ok: 'bg-emerald-500',
  warn: 'bg-yellow-500',
  error: 'bg-red-500',
} as const

function HealthStat({ icon, label, value, status, children }: {
  icon: string
  label: string
  value: string
  status?: 'ok' | 'warn' | 'error'
  children?: ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700/60 transition-colors cursor-pointer">
          <span className={`material-symbols-outlined text-[14px] ${status ? STATUS_COLORS[status] : 'text-slate-400'}`}>{icon}</span>
          <span className="text-xs font-semibold text-slate-900 dark:text-white">{value}</span>
          <span className="text-[10px] text-slate-500">{label}</span>
        </button>
      </PopoverTrigger>
      {children && (
        <PopoverContent align="center" className="w-56 p-3">
          {children}
        </PopoverContent>
      )}
    </Popover>
  )
}

function DetailRow({ label, value, status }: { label: string; value: string | number; status?: 'ok' | 'warn' | 'error' }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="flex items-center gap-1.5">
        {status && <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_BG[status]}`} />}
        <span className="text-xs font-semibold text-slate-900 dark:text-white">{value}</span>
      </div>
    </div>
  )
}

function DetailLink({ to, params, label }: { to: string; params?: Record<string, string>; label: string }) {
  return (
    <Link
      to={to}
      params={params}
      className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-primary hover:text-primary/80 transition-colors"
    >
      {label}
      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
    </Link>
  )
}

export function Header() {
  const navigate = useNavigate()
  const { data: contextData } = useContexts()
  const switchContext = useSwitchContext()
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'd') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const currentContext = contextData?.current
  const contexts = contextData?.contexts ?? []

  const healthInterval = usePollingInterval(60_000)
  const { data: health } = useQuery({
    queryKey: ['cluster-health'],
    queryFn: () => api.clusterHealth(),
    staleTime: 60_000,
    refetchInterval: healthInterval,
  })

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const q = searchValue.trim()
    if (!q) return
    navigate({ to: '/search', search: { q } })
  }, [searchValue, navigate])

  return (
    <header className="h-16 flex items-center border-b border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-6 shrink-0 z-20">
      <div className="flex items-center gap-4 shrink-0">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="size-8 text-blue-500 flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">hexagon</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight font-display">KuberViewer</h1>
        </Link>

      </div>

      <div className="flex-1 flex justify-center px-8">
        <form onSubmit={handleSearch} className="w-full max-w-md">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-slate-400 pointer-events-none">
              search
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search pods, services, deployments..."
              className="w-full pl-10 pr-10 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-colors"
            />
            {!searchValue && (
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono border border-border-light dark:border-border-dark rounded px-1.5 py-0.5 pointer-events-none">
                Alt+D
              </kbd>
            )}
            {searchValue && (
              <button
                type="button"
                onClick={() => setSearchValue('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {health && (
          <div className="hidden lg:flex items-center gap-2">
            <HealthStat
              icon="dns"
              label="Nodes"
              value={`${health.nodes.ready}/${health.nodes.total}`}
              status={health.nodes.ready === health.nodes.total ? 'ok' : 'warn'}
            >
              <DetailRow label="Ready" value={health.nodes.ready} status="ok" />
              <DetailRow label="Not Ready" value={health.nodes.total - health.nodes.ready} status={health.nodes.total - health.nodes.ready > 0 ? 'error' : 'ok'} />
              <DetailRow label="Total" value={health.nodes.total} />
              <DetailLink to="/nodes" label="View all nodes" />
            </HealthStat>
            <HealthStat
              icon="layers"
              label="Deploys"
              value={`${health.deployments.ready}/${health.deployments.total}`}
              status={health.deployments.ready === health.deployments.total ? 'ok' : 'warn'}
            >
              <DetailRow label="Ready" value={health.deployments.ready} status="ok" />
              <DetailRow label="Not Ready" value={health.deployments.total - health.deployments.ready} status={health.deployments.total - health.deployments.ready > 0 ? 'warn' : 'ok'} />
              <DetailRow label="Total" value={health.deployments.total} />
              <DetailLink to="/resources/$" params={{ _splat: 'apps/v1/deployments' }} label="View all deployments" />
            </HealthStat>
            <HealthStat
              icon="deployed_code"
              label="Pods"
              value={`${health.pods.running}/${health.pods.total}`}
              status={health.pods.failed > 0 || Object.values(health.pods.issues).some(v => v > 0) ? 'error' : health.pods.pending > 0 ? 'warn' : 'ok'}
            >
              <DetailRow label="Running" value={health.pods.running} status="ok" />
              <DetailRow label="Pending" value={health.pods.pending} status={health.pods.pending > 0 ? 'warn' : 'ok'} />
              <DetailRow label="Failed" value={health.pods.failed} status={health.pods.failed > 0 ? 'error' : 'ok'} />
              {Object.entries(health.pods.issues).map(([reason, count]) => (
                <DetailRow key={reason} label={reason} value={count} status={count > 0 ? 'error' : 'ok'} />
              ))}
              <DetailRow label="Total" value={health.pods.total} />
              <DetailLink to="/resources/$" params={{ _splat: 'v1/pods' }} label="View all pods" />
            </HealthStat>
            <HealthStat icon="folder" label="NS" value={String(health.namespaces)}>
              <DetailRow label="Total" value={health.namespaces} />
              <DetailLink to="/namespaces" label="View all namespaces" />
            </HealthStat>
            <HealthStat icon="lan" label="Svcs" value={String(health.services)}>
              <DetailRow label="Total" value={health.services} />
              <DetailLink to="/resources/$" params={{ _splat: 'v1/services' }} label="View all services" />
            </HealthStat>
          </div>
        )}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button className="hidden sm:flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-w-[180px]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">dns</span>
                <span className="text-sm font-medium">{currentContext ?? 'No context'}</span>
              </div>
              <span className="material-symbols-outlined text-slate-400 text-[18px]">unfold_more</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[400px] max-w-[90vw] p-0">
            <Command>
              <CommandInput
                placeholder="Search contexts..."
                onValueChange={() => {
                  requestAnimationFrame(() => {
                    listRef.current?.scrollTo({ top: 0 })
                  })
                }}
              />
              <CommandList ref={listRef}>
                <CommandEmpty>No contexts found.</CommandEmpty>
                <CommandGroup heading="Cluster Context">
                  {contexts.map((ctx) => (
                    <CommandItem
                      key={ctx.name}
                      value={ctx.name}
                      onSelect={() => {
                        switchContext.mutate(ctx.name)
                        setOpen(false)
                      }}
                      className={ctx.name === currentContext ? 'bg-primary/10 text-primary' : ''}
                    >
                      <span className="material-symbols-outlined text-[16px]">dns</span>
                      <span className="truncate">{ctx.name}</span>
                      {ctx.name === currentContext && (
                        <span className="material-symbols-outlined ml-auto text-[16px]">check</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="material-symbols-outlined">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
        </div>

        <div className="h-9 w-9 rounded-full bg-linear-to-tr from-primary to-purple-500 p-[2px] cursor-pointer">
          <div className="h-full w-full rounded-full bg-surface-light dark:bg-surface-dark flex items-center justify-center">
            <span className="font-bold text-xs text-primary">K8</span>
          </div>
        </div>
      </div>
    </header>
  )
}
