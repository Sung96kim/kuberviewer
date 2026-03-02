import { Link, Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Header } from '#/components/layout/Header'
import { Sidebar } from '#/components/layout/Sidebar'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFound,
})

function RootComponent() {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="material-symbols-outlined text-6xl text-slate-600 mb-4">explore_off</span>
      <h2 className="text-2xl font-bold text-white mb-2">Page Not Found</h2>
      <p className="text-slate-400 mb-6">The page you are looking for does not exist.</p>
      <Link to="/" className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors">
        Go Home
      </Link>
    </div>
  )
}
