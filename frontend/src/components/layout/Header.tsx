import { useState, useCallback, useRef } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useContexts, useSwitchContext } from '#/hooks/use-contexts'
import { useTheme } from '#/hooks/use-theme'
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

export function Header() {
  const navigate = useNavigate()
  const { data: contextData } = useContexts()
  const switchContext = useSwitchContext()
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const currentContext = contextData?.current
  const contexts = contextData?.contexts ?? []

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

      <div className="flex-1 flex justify-center px-8">
        <form onSubmit={handleSearch} className="w-full max-w-md">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-slate-400 pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search pods, services, deployments..."
              className="w-full pl-10 pr-10 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-colors"
            />
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
