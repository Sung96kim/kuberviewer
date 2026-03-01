import { useContexts, useSwitchContext } from '#/hooks/use-contexts'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'

export function Header() {
  const { data: contextData } = useContexts()
  const switchContext = useSwitchContext()

  const currentContext = contextData?.current
  const contexts = contextData?.contexts ?? []

  return (
    <header className="h-16 flex items-center justify-between border-b border-border-dark bg-surface-dark px-6 shrink-0 z-20">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="size-8 text-primary">
            <span className="material-symbols-outlined text-3xl">hexagon</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight font-display">KuberViewer</h1>
        </div>

        {currentContext && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-400">
              Connected to {currentContext}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hidden sm:flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border-dark bg-background-dark hover:bg-slate-800 transition-colors min-w-[180px]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">dns</span>
                <span className="text-sm font-medium">{currentContext ?? 'No context'}</span>
              </div>
              <span className="material-symbols-outlined text-slate-400 text-[18px]">unfold_more</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[220px]">
            <DropdownMenuLabel>Cluster Context</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {contexts.map((ctx) => (
              <DropdownMenuItem
                key={ctx.name}
                onSelect={() => switchContext.mutate(ctx.name)}
                className={ctx.name === currentContext ? 'bg-primary/10 text-primary' : ''}
              >
                <span className="material-symbols-outlined text-[16px]">dns</span>
                <span className="truncate">{ctx.name}</span>
                {ctx.name === currentContext && (
                  <span className="material-symbols-outlined ml-auto text-[16px]">check</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
            <span className="material-symbols-outlined">search</span>
          </button>
          <button className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
            <span className="material-symbols-outlined">dark_mode</span>
          </button>
        </div>

        <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-primary to-purple-500 p-[2px] cursor-pointer">
          <div className="h-full w-full rounded-full bg-surface-dark flex items-center justify-center">
            <span className="font-bold text-xs text-primary">K8</span>
          </div>
        </div>
      </div>
    </header>
  )
}
