import { useState, useCallback, useMemo, useEffect } from 'react'
import { useResourceList } from '#/hooks/use-resource-list'
import { useSettings } from '#/hooks/use-settings'
import { Button } from '#/components/ui/button'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '#/components/ui/command'

type PodSpec = {
  containers?: { name: string }[]
  initContainers?: { name: string }[]
}

type PodItem = {
  metadata?: { name?: string; namespace?: string }
  status?: { phase?: string }
  spec?: PodSpec
}

type NamespaceItem = {
  metadata?: { name?: string }
}

type SelectedPod = {
  namespace: string
  name: string
  containers: string[]
}

type LogPodSearchDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (pods: SelectedPod[]) => void
}

const PHASE_COLORS: Record<string, string> = {
  Running: 'text-green-400',
  Succeeded: 'text-blue-400',
  Pending: 'text-yellow-400',
  Failed: 'text-red-400',
}

function getPhaseColor(phase: string): string {
  return PHASE_COLORS[phase] ?? 'text-slate-400'
}

function extractContainers(pod: PodItem): string[] {
  const containers = (pod.spec?.containers ?? []).map((c) => c.name)
  const initContainers = (pod.spec?.initContainers ?? []).map((c) => c.name)
  return [...containers, ...initContainers]
}

function podKey(pod: PodItem): string {
  return `${pod.metadata?.namespace ?? ''}/${pod.metadata?.name ?? ''}`
}

export function LogPodSearchDialog({ open, onOpenChange, onSelect }: LogPodSearchDialogProps) {
  const { settings } = useSettings()
  const [search, setSearch] = useState('')
  const [namespace, setNamespace] = useState(settings.defaultNamespace || 'default')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        document.querySelector<HTMLInputElement>('[cmdk-input]')?.focus()
      })
    }
  }, [open])

  const { data: nsData } = useResourceList({
    group: '',
    version: 'v1',
    name: 'namespaces',
    namespaced: false,
  })

  const namespaces = useMemo(
    () => ((nsData?.items ?? []) as NamespaceItem[]).map((ns) => ns.metadata?.name ?? '').filter(Boolean).sort(),
    [nsData],
  )

  const { data: podData, isLoading } = useResourceList({
    group: '',
    version: 'v1',
    name: 'pods',
    namespaced: true,
    namespace,
  })

  const allPods = (podData?.items ?? []) as PodItem[]

  const pods = useMemo(() => {
    if (!search) return allPods
    const q = search.toLowerCase()
    return allPods.filter((pod) => (pod.metadata?.name ?? '').toLowerCase().includes(q))
  }, [allPods, search])

  const togglePod = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const handleConfirm = useCallback(() => {
    const selectedPods: SelectedPod[] = allPods
      .filter((pod) => selected.has(podKey(pod)))
      .map((pod) => ({
        namespace: pod.metadata?.namespace ?? 'default',
        name: pod.metadata?.name ?? '',
        containers: extractContainers(pod),
      }))
    onSelect(selectedPods)
    onOpenChange(false)
    setSearch('')
    setSelected(new Set())
  }, [allPods, selected, onSelect, onOpenChange])

  const handleClose = useCallback((value: boolean) => {
    onOpenChange(value)
    if (!value) {
      setSearch('')
      setSelected(new Set())
    }
  }, [onOpenChange])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && selected.size > 0) {
        e.preventDefault()
        e.stopPropagation()
        handleConfirm()
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [open, selected.size, handleConfirm])

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleClose}
      title="Add Pods"
      description="Select pods to stream their logs"
      showCloseButton={false}
      shouldFilter={false}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <span className="text-xs text-slate-500 shrink-0">Namespace:</span>
        <select
          value={namespace}
          onChange={(e) => {
            setNamespace(e.target.value)
            setSelected(new Set())
          }}
          className="flex-1 text-sm bg-transparent border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
        >
          {namespaces.map((ns) => (
            <option key={ns} value={ns} className="bg-popover text-popover-foreground">{ns}</option>
          ))}
        </select>
      </div>
      <CommandInput
        placeholder="Search pods..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          {isLoading ? 'Loading pods...' : 'No pods found.'}
        </CommandEmpty>
        <CommandGroup heading="Pods">
          {pods.map((pod) => {
            const name = pod.metadata?.name ?? ''
            const ns = pod.metadata?.namespace ?? ''
            const phase = pod.status?.phase ?? 'Unknown'
            const containerCount = extractContainers(pod).length
            const key = `${ns}/${name}`
            const isSelected = selected.has(key)
            return (
              <CommandItem
                key={key}
                value={key}
                onSelect={() => togglePod(key)}
                className="flex items-center gap-3 cursor-pointer"
              >
                <span className={`material-symbols-outlined text-[16px] ${isSelected ? 'text-primary' : 'text-slate-500'}`}>
                  {isSelected ? 'check_box' : 'check_box_outline_blank'}
                </span>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm text-slate-900 dark:text-white truncate">{name}</span>
                  <span className="text-xs text-slate-500 truncate">
                    {containerCount > 1 && `${containerCount} containers`}
                  </span>
                </div>
                <span className={`text-xs font-medium ${getPhaseColor(phase)}`}>
                  {phase}
                </span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
      {selected.size > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border">
          <span className="text-xs text-slate-500">
            {selected.size} pod{selected.size > 1 ? 's' : ''} selected
          </span>
          <Button size="sm" onClick={handleConfirm}>
            Add {selected.size} pod{selected.size > 1 ? 's' : ''}
            <kbd className="ml-1.5 text-[10px] opacity-60 font-mono">Ctrl+Enter</kbd>
          </Button>
        </div>
      )}
    </CommandDialog>
  )
}
