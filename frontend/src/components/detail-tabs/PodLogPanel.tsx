import { memo, useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useResource } from '#/hooks/use-resource'
import { LogTerminalView } from '#/components/logs/LogTerminalView'

type PodLogPanelProps = {
  namespace: string
  podName: string
  onClose: () => void
}

function getContainerNames(resource: Record<string, unknown>): string[] {
  const spec = resource.spec as { containers?: Array<{ name: string }>; initContainers?: Array<{ name: string }> } | undefined
  const names: string[] = []
  if (spec?.initContainers) {
    for (const c of spec.initContainers) names.push(c.name)
  }
  if (spec?.containers) {
    for (const c of spec.containers) names.push(c.name)
  }
  return names
}

const MIN_HEIGHT = 200
const DEFAULT_HEIGHT = 400
const MAX_HEIGHT_OFFSET = 200

export const PodLogPanel = memo(function PodLogPanel({
  namespace,
  podName,
  onClose,
}: PodLogPanelProps) {
  const { data: podData, isLoading } = useResource({
    group: '',
    version: 'v1',
    name: 'pods',
    namespaced: true,
    namespace,
    resourceName: podName,
  })

  const pod = podData as Record<string, unknown> | undefined
  const containers = useMemo(() => pod ? getContainerNames(pod) : [], [pod])
  const [selectedContainer, setSelectedContainer] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const draggingRef = useRef(false)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  useEffect(() => {
    if (containers.length > 0 && !selectedContainer) {
      setSelectedContainer(containers.find((c) => !c.startsWith('init-')) ?? containers[0])
    }
  }, [containers, selectedContainer])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const delta = e.clientY - startYRef.current
      const maxHeight = window.innerHeight - MAX_HEIGHT_OFFSET
      setHeight(Math.min(maxHeight, Math.max(MIN_HEIGHT, startHeightRef.current + delta)))
    }

    const handleMouseUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = true
    startYRef.current = e.clientY
    startHeightRef.current = height
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [height])

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border-light dark:border-border-dark">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-blue-400">deployed_code</span>
          <h3 className="text-sm font-bold">{podName}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-hover text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      {isLoading ? (
        <div className="px-5 py-12 text-center text-sm text-slate-500">Loading...</div>
      ) : (
        <div style={{ height: expanded ? `calc(100vh - ${MAX_HEIGHT_OFFSET}px)` : `${height}px` }}>
          <LogTerminalView
            namespace={namespace}
            podName={podName}
            containers={containers}
            selectedContainer={selectedContainer}
            onContainerChange={setSelectedContainer}
            expanded={expanded}
            onExpandToggle={() => setExpanded((v) => !v)}
          />
        </div>
      )}

      {!expanded && (
        <div
          onMouseDown={startDrag}
          className="h-1.5 cursor-row-resize bg-transparent hover:bg-primary/20 active:bg-primary/30 transition-colors"
        />
      )}
    </div>
  )
})
