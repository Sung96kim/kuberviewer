import { useState, useCallback } from 'react'
import { useResourceList } from '#/hooks/use-resource-list'
import { useTerminal } from '#/components/terminal/TerminalProvider'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '#/components/ui/command'

type PodMetadata = {
  name?: string
  namespace?: string
}

type PodStatus = {
  phase?: string
}

type PodItem = {
  metadata?: PodMetadata
  status?: PodStatus
}

type PodSearchDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
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

export function PodSearchDialog({ open, onOpenChange }: PodSearchDialogProps) {
  const { openSession } = useTerminal()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useResourceList({
    group: '',
    version: 'v1',
    name: 'pods',
    namespaced: false,
  })

  const pods = (data?.items ?? []) as PodItem[]

  const handleSelect = useCallback(
    (pod: PodItem) => {
      const namespace = pod.metadata?.namespace ?? 'default'
      const name = pod.metadata?.name ?? ''
      openSession({ namespace, pod: name })
      onOpenChange(false)
      setSearch('')
    },
    [openSession, onOpenChange],
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value)
        if (!value) setSearch('')
      }}
      title="Open Terminal"
      description="Search for a pod to open a terminal session"
      showCloseButton={false}
    >
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
            const namespace = pod.metadata?.namespace ?? ''
            const phase = pod.status?.phase ?? 'Unknown'
            return (
              <CommandItem
                key={`${namespace}/${name}`}
                value={`${namespace}/${name}`}
                onSelect={() => handleSelect(pod)}
                className="flex items-center gap-3 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-slate-500">
                  dns
                </span>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm text-slate-900 dark:text-white truncate">{name}</span>
                  <span className="text-xs text-slate-500 truncate">
                    {namespace}
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
    </CommandDialog>
  )
}
