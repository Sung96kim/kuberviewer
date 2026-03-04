import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useContexts, useSwitchContext, useDeleteContext } from '#/hooks/use-contexts'
import { Breadcrumb } from '#/components/layout/Breadcrumb'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'

export const Route = createFileRoute('/contexts')({ component: ContextsPage })

function ContextsPage() {
  const { data, isLoading } = useContexts()
  const switchContext = useSwitchContext()
  const deleteContext = useDeleteContext()
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [switchTo, setSwitchTo] = useState('')

  const contexts = data?.contexts ?? []
  const current = data?.current

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: 'Contexts' }]} />

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Contexts</h1>
          <span className="text-sm text-slate-500">{contexts.length} context{contexts.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        )}

        {!isLoading && (
          <div className="border border-border-light dark:border-border-dark rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-surface-highlight/50 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Cluster</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">User</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Namespace</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {contexts.map((ctx) => (
                  <tr key={ctx.name} className="hover:bg-slate-50 dark:hover:bg-surface-hover/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-[16px] ${ctx.name === current ? 'text-primary' : 'text-slate-400'}`}>dns</span>
                        <span className={`font-medium ${ctx.name === current ? 'text-primary' : ''}`}>{ctx.name}</span>
                        {ctx.name === current && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">Active</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{ctx.cluster}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{ctx.user}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{ctx.namespace ?? '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {ctx.name !== current && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => switchContext.mutate(ctx.name)}
                          >
                            Switch
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => {
                            setDeleteTarget(ctx.name)
                            if (ctx.name === current) {
                              const other = contexts.find((c) => c.name !== ctx.name)
                              setSwitchTo(other?.name ?? '')
                            } else {
                              setSwitchTo('')
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={deleteTarget !== null} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete context</DialogTitle>
            <DialogDescription>
              Remove <span className="font-semibold text-slate-900 dark:text-white">{deleteTarget}</span> from your kubeconfig? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget === current && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                This is your active context. Switch to:
              </label>
              <select
                value={switchTo}
                onChange={(e) => setSwitchTo(e.target.value)}
                className="w-full rounded-md border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm px-3 py-2 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary focus:outline-none"
              >
                {contexts.filter((c) => c.name !== deleteTarget).map((c) => (
                  <option key={c.name} value={c.name} className="bg-popover text-popover-foreground">{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteTarget === current && !switchTo}
              onClick={() => {
                if (!deleteTarget) return
                deleteContext.mutate(
                  { name: deleteTarget, switchTo: deleteTarget === current ? switchTo : undefined },
                  { onSuccess: () => setDeleteTarget(null) },
                )
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
