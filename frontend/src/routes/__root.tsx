import { Link, Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Header } from '#/components/layout/Header'
import { Sidebar } from '#/components/layout/Sidebar'
import { TerminalProvider } from '#/components/terminal/TerminalProvider'
import { TerminalDrawer } from '#/components/terminal/TerminalDrawer'
import { TerminalFab } from '#/components/terminal/TerminalFab'
import { useSettings } from '#/hooks/use-settings'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFound,
})

function RootComponent() {
  const { settings } = useSettings()
  const compact = settings.compactMode

  return (
    <TerminalProvider>
      <div className="flex h-screen flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className={`flex-1 overflow-auto ${compact ? 'p-4 md:p-5' : 'p-6 md:p-8'}`}>
            <Outlet />
          </main>
        </div>
        <TerminalDrawer />
        <TerminalFab />
      </div>
    </TerminalProvider>
  )
}

function NotFound() {
  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex items-center justify-center shadow-lg">
          <span className="material-symbols-outlined text-5xl text-slate-500">dns</span>
        </div>
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
          404
        </div>
      </div>

      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Page Not Found</h2>
      <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md">
        The page you&apos;re looking for could not be found.
      </p>

      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-5 mb-8 max-w-md w-full text-left">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-lg text-primary">info</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Why am I seeing this?</span>
        </div>
        <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <li className="flex items-start gap-2">
            <span className="material-symbols-outlined text-base text-slate-500 dark:text-slate-600 mt-0.5 shrink-0">circle</span>
            The resource may have been deleted or terminated.
          </li>
          <li className="flex items-start gap-2">
            <span className="material-symbols-outlined text-base text-slate-500 dark:text-slate-600 mt-0.5 shrink-0">circle</span>
            It might have been moved to a different namespace.
          </li>
          <li className="flex items-start gap-2">
            <span className="material-symbols-outlined text-base text-slate-500 dark:text-slate-600 mt-0.5 shrink-0">circle</span>
            The URL or resource ID might be incorrect.
          </li>
        </ul>
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-lg">home</span>
          Go Home
        </Link>
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-slate-700 dark:text-slate-300 font-medium hover:bg-surface-highlight transition-colors"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          Refresh
        </button>
      </div>
    </div>
  )
}
