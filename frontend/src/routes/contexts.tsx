import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useContexts, useSwitchContext, useDeleteContext, useBulkDeleteContexts } from '#/hooks/use-contexts'
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
  const bulkDelete = useBulkDeleteContexts()
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [switchTo, setSwitchTo] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkSwitchTo, setBulkSwitchTo] = useState('')
  const [bulkError, setBulkError] = useState<string | null>(null)

  const current = data?.current
  const contexts = useMemo(() => {
    const list = data?.contexts ?? []
    return [...list].sort((a, b) => {
      if (a.name === current) return -1
      if (b.name === current) return 1
      return 0
    })
  }, [data?.contexts, current])

  const allSelected = contexts.length > 0 && selected.size === contexts.length
  const someSelected = selected.size > 0 && selected.size < contexts.length
  const includesActive = current ? selected.has(current) : false
  const nonSelectedContexts = contexts.filter((c) => !selected.has(c.name))

  function toggleOne(name: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(contexts.map((c) => c.name)))
  }

  function openBulkDelete() {
    setBulkError(null)
    if (includesActive && nonSelectedContexts.length > 0) {
      setBulkSwitchTo(nonSelectedContexts[0].name)
    } else {
      setBulkSwitchTo('')
    }
    setBulkDeleteOpen(true)
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 space-y-6">
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
          <div className="border border-border-light dark:border-border-dark rounded-lg overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="bg-slate-50 dark:bg-surface-highlight/50 text-left">
                  <th className="w-12 cursor-pointer select-none" onClick={toggleAll}>
                    <div className="flex items-center justify-center h-full">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected }}
                        onChange={toggleAll}
                        className="size-4 rounded border-slate-300 dark:border-slate-600 accent-primary pointer-events-none"
                      />
                    </div>
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-[28%]">Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-[23%]">Cluster</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-[14%]">User</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-[14%]">Namespace</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-[14%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {contexts.map((ctx) => (
                  <tr key={ctx.name} className={`hover:bg-slate-50 dark:hover:bg-surface-hover/30 transition-colors ${selected.has(ctx.name) ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                    <td className="cursor-pointer select-none" onClick={() => toggleOne(ctx.name)}>
                      <div className="flex items-center justify-center h-full">
                        <input
                          type="checkbox"
                          checked={selected.has(ctx.name)}
                          onChange={() => toggleOne(ctx.name)}
                          className="size-4 rounded border-slate-300 dark:border-slate-600 accent-primary pointer-events-none"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-[16px] ${ctx.name === current ? 'text-primary' : 'text-slate-400'}`}>dns</span>
                        <span className={`font-medium truncate ${ctx.name === current ? 'text-primary' : ''}`} title={ctx.name}>{ctx.name}</span>
                        {ctx.name === current && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">Active</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 truncate" title={ctx.cluster}>{ctx.cluster}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 truncate" title={ctx.user}>{ctx.user}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 truncate">{ctx.namespace ?? '-'}</td>
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
                            setDeleteError(null)
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

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-surface-highlight shadow-lg">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button variant="ghost" size="xs" onClick={() => setSelected(new Set())}>Clear</Button>
          <Button variant="destructive" size="sm" onClick={openBulkDelete}>
            Delete selected
          </Button>
        </div>
      )}

      {/* Single delete dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete context</DialogTitle>
            <DialogDescription>
              Remove <span className="font-semibold text-slate-900 dark:text-white">{deleteTarget}</span> from your kubeconfig? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 flex items-center gap-2">
              <span className="material-symbols-outlined text-red-400 text-[16px]">error</span>
              <span className="text-sm text-red-400">{deleteError}</span>
            </div>
          )}
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
              disabled={(deleteTarget === current && !switchTo) || deleteContext.isPending}
              onClick={() => {
                if (!deleteTarget) return
                setDeleteError(null)
                deleteContext.mutate(
                  { name: deleteTarget, switchTo: deleteTarget === current ? switchTo : undefined },
                  {
                    onSuccess: () => { setDeleteTarget(null); setDeleteError(null) },
                    onError: (err) => setDeleteError(err instanceof Error ? err.message : 'Failed to delete context'),
                  },
                )
              }}
            >
              {deleteContext.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(v) => { if (!v) setBulkDeleteOpen(false) }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete {selected.size} context{selected.size !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              Remove the following from your kubeconfig? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {[...selected].map((name) => (
              <div key={name} className="flex items-center gap-2 text-sm px-2 py-1 rounded bg-slate-50 dark:bg-surface-highlight/50">
                <span className={`material-symbols-outlined text-[14px] ${name === current ? 'text-primary' : 'text-slate-400'}`}>dns</span>
                <span className={name === current ? 'text-primary font-medium' : ''}>{name}</span>
                {name === current && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">Active</span>
                )}
              </div>
            ))}
          </div>
          {bulkError && (
            <div className="px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 flex items-center gap-2">
              <span className="material-symbols-outlined text-red-400 text-[16px]">error</span>
              <span className="text-sm text-red-400">{bulkError}</span>
            </div>
          )}
          {includesActive && nonSelectedContexts.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Your active context is selected. Switch to:
              </label>
              <select
                value={bulkSwitchTo}
                onChange={(e) => setBulkSwitchTo(e.target.value)}
                className="w-full rounded-md border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm px-3 py-2 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary focus:outline-none"
              >
                {nonSelectedContexts.map((c) => (
                  <option key={c.name} value={c.name} className="bg-popover text-popover-foreground">{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={(includesActive && !bulkSwitchTo) || bulkDelete.isPending}
              onClick={() => {
                setBulkError(null)
                bulkDelete.mutate(
                  { names: [...selected], switchTo: includesActive ? bulkSwitchTo : undefined },
                  {
                    onSuccess: () => { setBulkDeleteOpen(false); setSelected(new Set()); setBulkError(null) },
                    onError: (err) => setBulkError(err instanceof Error ? err.message : 'Failed to delete contexts'),
                  },
                )
              }}
            >
              {bulkDelete.isPending ? 'Deleting...' : `Delete ${selected.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
