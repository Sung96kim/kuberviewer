import { useState, useCallback, useEffect, useRef, memo, Fragment } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { LogPanel, type LogPanelHandle } from '#/components/logs/LogPanel'
import { LogPodSearchDialog } from '#/components/logs/LogPodSearchDialog'
import { useContexts } from '#/hooks/use-contexts'

export const Route = createFileRoute('/logs')({
  component: LogsPage,
})

type LogPanelState = {
  id: string
  namespace: string
  pod: string
  container: string
  containers: string[]
}

type LogGroup = {
  id: string
  name: string
  panels: LogPanelState[]
}

type LogGroupsState = {
  activeGroupId: string
  groups: LogGroup[]
}

const GROUPS_STORAGE_PREFIX = 'kuberviewer:log-groups'
const LEGACY_STORAGE_KEY = 'kuberviewer:log-panels'

function storageKey(context: string) {
  return context ? `${GROUPS_STORAGE_PREFIX}:${context}` : GROUPS_STORAGE_PREFIX
}

function createDefaultGroup(panels: LogPanelState[] = []): LogGroup {
  return { id: crypto.randomUUID(), name: 'Group 1', panels }
}

function loadGroups(context: string): LogGroupsState {
  try {
    const raw = sessionStorage.getItem(storageKey(context))
    if (raw) {
      const state = JSON.parse(raw) as LogGroupsState
      if (state.groups.length > 0) return state
    }
    const legacy = sessionStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      const panels = JSON.parse(legacy) as LogPanelState[]
      sessionStorage.removeItem(LEGACY_STORAGE_KEY)
      const group = createDefaultGroup(panels)
      return { activeGroupId: group.id, groups: [group] }
    }
  } catch {}
  const group = createDefaultGroup()
  return { activeGroupId: group.id, groups: [group] }
}

function saveGroups(context: string, state: LogGroupsState) {
  sessionStorage.setItem(storageKey(context), JSON.stringify(state))
}

function getColsPerRow(count: number): number {
  if (count <= 1) return 1
  if (count <= 4) return 2
  return 3
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

function equalArray(count: number): number[] {
  if (count <= 0) return []
  const val = 100 / count
  return Array.from({ length: count }, () => val)
}

type DragState = {
  type: 'col' | 'row'
  rowIndex: number
  colIndex: number
}

type ResizableGridProps = {
  panels: LogPanelState[]
  focusedId: string | null
  activeId: string | null
  panelRefs: React.MutableRefObject<Map<string, LogPanelHandle>>
  onClose: (id: string) => void
  onContainerChange: (id: string, container: string) => void
  onFocus: (id: string | null) => void
  onActivate: (id: string) => void
}

const FOCUS_MAIN = 85
const FOCUS_OTHER = 15

function buildFocusedRowHeights(rows: LogPanelState[][], focusRow: number): number[] {
  const otherCount = rows.length - 1
  if (otherCount === 0) return [100]
  const otherEach = FOCUS_OTHER / otherCount
  return rows.map((_, i) => (i === focusRow ? FOCUS_MAIN : otherEach))
}

function buildFocusedColWidths(rows: LogPanelState[][], focusRow: number, focusCol: number): number[][] {
  return rows.map((row, ri) => {
    if (ri === focusRow) {
      const otherCount = row.length - 1
      if (otherCount === 0) return [100]
      const otherEach = FOCUS_OTHER / otherCount
      return row.map((_, ci) => (ci === focusCol ? FOCUS_MAIN : otherEach))
    }
    return equalArray(row.length)
  })
}

const ResizableGrid = memo(function ResizableGrid({
  panels,
  focusedId,
  activeId,
  panelRefs,
  onClose,
  onContainerChange,
  onFocus,
  onActivate,
}: ResizableGridProps) {
  const colsPerRow = getColsPerRow(panels.length)
  const rows = chunkArray(panels, colsPerRow)
  const layoutKey = `${rows.length}-${rows.map((r) => r.length).join(',')}`

  const [rowHeights, setRowHeights] = useState(() => equalArray(rows.length))
  const [colWidths, setColWidths] = useState<number[][]>(() =>
    rows.map((row) => equalArray(row.length)),
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])
  const dragRef = useRef<DragState | null>(null)
  const prevLayoutRef = useRef(layoutKey)
  const savedRowHeights = useRef<number[] | null>(null)
  const savedColWidths = useRef<number[][] | null>(null)

  useEffect(() => {
    if (layoutKey !== prevLayoutRef.current) {
      prevLayoutRef.current = layoutKey
      savedRowHeights.current = null
      savedColWidths.current = null
      const newRows = chunkArray(panels, getColsPerRow(panels.length))
      setRowHeights(equalArray(newRows.length))
      setColWidths(newRows.map((row) => equalArray(row.length)))
    }
  }, [layoutKey, panels])

  useEffect(() => {
    if (focusedId) {
      let focusRow = -1
      let focusCol = -1
      for (let ri = 0; ri < rows.length; ri++) {
        const ci = rows[ri].findIndex((p) => p.id === focusedId)
        if (ci !== -1) {
          focusRow = ri
          focusCol = ci
          break
        }
      }
      if (focusRow === -1) return

      setRowHeights((prev) => {
        savedRowHeights.current = prev
        return buildFocusedRowHeights(rows, focusRow)
      })
      setColWidths((prev) => {
        savedColWidths.current = prev
        return buildFocusedColWidths(rows, focusRow, focusCol)
      })
    } else {
      if (savedRowHeights.current) {
        setRowHeights(savedRowHeights.current)
        savedRowHeights.current = null
      }
      if (savedColWidths.current) {
        setColWidths(savedColWidths.current)
        savedColWidths.current = null
      }
    }
  }, [focusedId])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return

      if (dragRef.current.type === 'row' && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const { rowIndex } = dragRef.current

        setRowHeights((prev) => {
          const next = [...prev]
          const offset = next.slice(0, rowIndex).reduce((a, b) => a + b, 0)
          const total = next[rowIndex] + next[rowIndex + 1]
          const pct = ((e.clientY - rect.top) / rect.height) * 100
          const newTop = Math.min(total - 15, Math.max(15, pct - offset))
          next[rowIndex] = newTop
          next[rowIndex + 1] = total - newTop
          return next
        })
      } else if (dragRef.current.type === 'col') {
        const { rowIndex, colIndex } = dragRef.current
        const rowEl = rowRefs.current[rowIndex]
        if (!rowEl) return

        const rect = rowEl.getBoundingClientRect()

        setColWidths((prev) => {
          const next = prev.map((r) => [...r])
          const row = next[rowIndex]
          const offset = row.slice(0, colIndex).reduce((a, b) => a + b, 0)
          const total = row[colIndex] + row[colIndex + 1]
          const pct = ((e.clientX - rect.left) / rect.width) * 100
          const newLeft = Math.min(total - 15, Math.max(15, pct - offset))
          row[colIndex] = newLeft
          row[colIndex + 1] = total - newLeft
          return next
        })
      }
    }

    const handleMouseUp = () => {
      if (dragRef.current) {
        dragRef.current = null
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

  const startRowDrag = useCallback((rowIndex: number) => (e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { type: 'row', rowIndex, colIndex: 0 }
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const startColDrag = useCallback((rowIndex: number, colIndex: number) => (e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { type: 'col', rowIndex, colIndex }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  return (
    <div ref={containerRef} className="flex flex-col flex-1 min-h-0">
      {rows.map((row, ri) => (
        <Fragment key={ri}>
          {ri > 0 && (
            <div
              onMouseDown={startRowDrag(ri - 1)}
              className="h-1 shrink-0 cursor-row-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
            />
          )}
          <div
            ref={(el) => { rowRefs.current[ri] = el }}
            className="flex min-h-0"
            style={{ flex: `${rowHeights[ri] ?? 50} 0 0%` }}
          >
            {row.map((panel, ci) => (
              <Fragment key={panel.id}>
                {ci > 0 && (
                  <div
                    onMouseDown={startColDrag(ri, ci - 1)}
                    className="w-1 shrink-0 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
                  />
                )}
                <div
                  className="min-w-0 min-h-0"
                  style={{ flex: `${colWidths[ri]?.[ci] ?? 50} 0 0%` }}
                >
                  <LogPanel
                    ref={(handle) => {
                      if (handle) panelRefs.current.set(panel.id, handle)
                      else panelRefs.current.delete(panel.id)
                    }}
                    id={panel.id}
                    namespace={panel.namespace}
                    pod={panel.pod}
                    container={panel.container}
                    containers={panel.containers}
                    active={panel.id === activeId}
                    focused={panel.id === focusedId}
                    onClose={onClose}
                    onContainerChange={onContainerChange}
                    onFocus={onFocus}
                    onActivate={onActivate}
                  />
                </div>
              </Fragment>
            ))}
          </div>
        </Fragment>
      ))}
    </div>
  )
})

const HOTKEYS: { key: string; label: string }[] = [
  { key: '↑↓←→', label: 'Navigate panels' },
  { key: 'F', label: 'Focus/unfocus panel' },
  { key: 'T / Ctrl+`', label: 'Toggle shell' },
  { key: 'Ctrl+F', label: 'Search logs' },
  { key: 'X', label: 'Close panel' },
  { key: 'A', label: 'Add pods' },
  { key: '[ ]', label: 'Prev/next group' },
  { key: 'N', label: 'New group' },
  { key: 'W', label: 'Close group' },
  { key: 'R', label: 'Rename group' },
  { key: '1-9', label: 'Go to group' },
]

type GroupTabProps = {
  group: LogGroup
  active: boolean
  index: number
  isOnly: boolean
  editing: boolean
  onSelect: () => void
  onStartRename: () => void
  onRename: (name: string) => void
  onEditDone: () => void
  onDuplicate: () => void
  onClose: () => void
  onReorder: (fromId: string, toId: string) => void
}

function GroupTab({ group, active, index, isOnly, editing, onSelect, onStartRename, onRename, onEditDone, onDuplicate, onClose, onReorder }: GroupTabProps) {
  const [editValue, setEditValue] = useState(group.name)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const dragCounterRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setEditValue(group.name)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [editing, group.name])

  const commitRename = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== group.name) onRename(trimmed)
    onEditDone()
  }

  return (
    <div
      className="group/tab flex items-center"
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', group.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDragEnter={() => {
        dragCounterRef.current++
        setDragOver(true)
      }}
      onDragLeave={() => {
        dragCounterRef.current--
        if (dragCounterRef.current === 0) setDragOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        dragCounterRef.current = 0
        setDragOver(false)
        const fromId = e.dataTransfer.getData('text/plain')
        if (fromId && fromId !== group.id) onReorder(fromId, group.id)
      }}
      onDragEnd={() => {
        dragCounterRef.current = 0
        setDragOver(false)
      }}
    >
      <button
        onClick={onSelect}
        onDoubleClick={(e) => {
          e.stopPropagation()
          onStartRename()
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenuOpen(true)
        }}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-t-md border border-b-0 transition-colors',
          dragOver
            ? 'border-primary bg-primary/10'
            : active
              ? 'bg-slate-100 dark:bg-surface-highlight text-slate-900 dark:text-white border-border-light dark:border-border-dark'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-hover/50 border-transparent'
        )}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') onEditDone()
            }}
            className="bg-transparent border-none outline-none w-24 text-sm"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">{index + 1}</span>
            <span className="truncate w-[100px]">{group.name}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">({group.panels.length})</span>
          </>
        )}
      </button>
      {!editing && (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button className="opacity-0 group-hover/tab:opacity-100 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-surface-hover transition-all">
              <span className="material-symbols-outlined text-[14px] text-slate-500 dark:text-slate-400">more_vert</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onSelect={onStartRename}>
              <span className="material-symbols-outlined text-[14px]">edit</span>
              Rename
              <DropdownMenuShortcut>R</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate}>
              <span className="material-symbols-outlined text-[14px]">content_copy</span>
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onClose} disabled={isOnly} variant="destructive">
              <span className="material-symbols-outlined text-[14px]">close</span>
              Close group
              <DropdownMenuShortcut>W</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

function LogsPage() {
  const { data: ctxData } = useContexts()
  const currentContext = ctxData?.current ?? ''
  const [groupsState, setGroupsState] = useState<LogGroupsState>(() => loadGroups(currentContext))
  const [searchOpen, setSearchOpen] = useState(false)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null)
  const panelRefs = useRef<Map<string, LogPanelHandle>>(new Map())
  const groupSelectionRef = useRef<Map<string, { activeId: string | null; focusedId: string | null }>>(new Map())

  const activeGroup = groupsState.groups.find(g => g.id === groupsState.activeGroupId) ?? groupsState.groups[0]
  const panels = activeGroup.panels

  useEffect(() => {
    setGroupsState(loadGroups(currentContext))
  }, [currentContext])

  useEffect(() => {
    saveGroups(currentContext, groupsState)
  }, [groupsState, currentContext])

  useEffect(() => {
    if (panels.length > 0 && !panels.some(p => p.id === activeId)) {
      setActiveId(panels[0].id)
    }
  }, [panels, activeId])

  const updateActiveGroup = useCallback((updater: (panels: LogPanelState[]) => LogPanelState[]) => {
    setGroupsState(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === prev.activeGroupId ? { ...g, panels: updater(g.panels) } : g
      ),
    }))
  }, [])

  const addPanels = useCallback((pods: { namespace: string; name: string; containers: string[] }[]) => {
    updateActiveGroup(prev => [
      ...prev,
      ...pods.map(pod => ({
        id: crypto.randomUUID(),
        namespace: pod.namespace,
        pod: pod.name,
        container: pod.containers[0] ?? '',
        containers: pod.containers,
      })),
    ])
  }, [updateActiveGroup])

  const removePanel = useCallback((id: string) => {
    updateActiveGroup(prev => prev.filter(p => p.id !== id))
    setFocusedId(prev => (prev === id ? null : prev))
    setActiveId(prev => (prev === id ? null : prev))
  }, [updateActiveGroup])

  const resetPanels = useCallback(() => {
    updateActiveGroup(() => [])
  }, [updateActiveGroup])

  const handleContainerChange = useCallback((id: string, container: string) => {
    updateActiveGroup(prev => prev.map(p => (p.id === id ? { ...p, container } : p)))
  }, [updateActiveGroup])

  const handleFocus = useCallback((id: string | null) => {
    setFocusedId(id)
  }, [])

  const switchGroup = useCallback((groupId: string) => {
    setGroupsState(prev => {
      if (prev.activeGroupId === groupId) return prev
      groupSelectionRef.current.set(prev.activeGroupId, { activeId, focusedId })
      return { ...prev, activeGroupId: groupId }
    })
    const saved = groupSelectionRef.current.get(groupId)
    setActiveId(saved?.activeId ?? null)
    setFocusedId(saved?.focusedId ?? null)
  }, [activeId, focusedId])

  const addGroup = useCallback(() => {
    const newGroup: LogGroup = {
      id: crypto.randomUUID(),
      name: `Group ${groupsState.groups.length + 1}`,
      panels: [],
    }
    groupSelectionRef.current.set(groupsState.activeGroupId, { activeId, focusedId })
    setGroupsState(prev => ({
      activeGroupId: newGroup.id,
      groups: [...prev.groups, newGroup],
    }))
    setActiveId(null)
    setFocusedId(null)
  }, [groupsState.groups.length, groupsState.activeGroupId, activeId, focusedId])

  const closeGroup = useCallback((groupId: string) => {
    setGroupsState(prev => {
      if (prev.groups.length <= 1) return prev
      const idx = prev.groups.findIndex(g => g.id === groupId)
      const newGroups = prev.groups.filter(g => g.id !== groupId)
      groupSelectionRef.current.delete(groupId)
      if (prev.activeGroupId !== groupId) return { ...prev, groups: newGroups }
      const newActiveIdx = Math.min(idx, newGroups.length - 1)
      const newActiveId = newGroups[newActiveIdx].id
      const saved = groupSelectionRef.current.get(newActiveId)
      setActiveId(saved?.activeId ?? null)
      setFocusedId(saved?.focusedId ?? null)
      return { activeGroupId: newActiveId, groups: newGroups }
    })
  }, [])

  const renameGroup = useCallback((groupId: string, name: string) => {
    setGroupsState(prev => ({
      ...prev,
      groups: prev.groups.map(g => (g.id === groupId ? { ...g, name } : g)),
    }))
  }, [])

  const reorderGroup = useCallback((fromId: string, toId: string) => {
    setGroupsState(prev => {
      const fromIdx = prev.groups.findIndex(g => g.id === fromId)
      const toIdx = prev.groups.findIndex(g => g.id === toId)
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev
      const newGroups = [...prev.groups]
      const [moved] = newGroups.splice(fromIdx, 1)
      newGroups.splice(toIdx, 0, moved)
      return { ...prev, groups: newGroups }
    })
  }, [])

  const duplicateGroup = useCallback((groupId: string) => {
    setGroupsState(prev => {
      const source = prev.groups.find(g => g.id === groupId)
      if (!source) return prev
      const newGroup: LogGroup = {
        id: crypto.randomUUID(),
        name: `${source.name} (Copy)`,
        panels: source.panels.map(p => ({ ...p, id: crypto.randomUUID() })),
      }
      const idx = prev.groups.findIndex(g => g.id === groupId)
      const newGroups = [...prev.groups]
      newGroups.splice(idx + 1, 0, newGroup)
      return { ...prev, groups: newGroups }
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && activeId) {
        e.preventDefault()
        panelRefs.current.get(activeId)?.openSearch()
        return
      }

      if (e.ctrlKey && e.key === '`' && activeId) {
        e.preventDefault()
        panelRefs.current.get(activeId)?.toggleShell()
        return
      }

      const el = e.target as HTMLElement
      const tag = el.tagName

      if (tag === 'INPUT' || tag === 'SELECT') return
      if (tag === 'TEXTAREA' && el.closest('[data-terminal="exec"]')) return
      if (el.getAttribute('contenteditable')) return

      const key = e.key

      if (key === '[') {
        e.preventDefault()
        const idx = groupsState.groups.findIndex(g => g.id === groupsState.activeGroupId)
        const prevIdx = idx > 0 ? idx - 1 : groupsState.groups.length - 1
        switchGroup(groupsState.groups[prevIdx].id)
        return
      }

      if (key === ']') {
        e.preventDefault()
        const idx = groupsState.groups.findIndex(g => g.id === groupsState.activeGroupId)
        const nextIdx = idx < groupsState.groups.length - 1 ? idx + 1 : 0
        switchGroup(groupsState.groups[nextIdx].id)
        return
      }

      if (key >= '1' && key <= '9') {
        const groupIdx = parseInt(key) - 1
        if (groupIdx < groupsState.groups.length) {
          e.preventDefault()
          switchGroup(groupsState.groups[groupIdx].id)
        }
        return
      }

      if (key === 'n' || key === 'N') {
        e.preventDefault()
        addGroup()
        return
      }

      if (key === 'w' || key === 'W') {
        e.preventDefault()
        closeGroup(groupsState.activeGroupId)
        return
      }

      if (key === 'r' || key === 'R') {
        e.preventDefault()
        setRenamingGroupId(groupsState.activeGroupId)
        return
      }

      if (key === 'a' || key === 'A') {
        e.preventDefault()
        setSearchOpen(true)
        return
      }

      if (panels.length === 0) return

      const colsPerRow = getColsPerRow(panels.length)
      const rows = chunkArray(panels, colsPerRow)

      const findPosition = (id: string | null): [number, number] => {
        if (!id) return [-1, -1]
        for (let ri = 0; ri < rows.length; ri++) {
          const ci = rows[ri].findIndex(p => p.id === id)
          if (ci !== -1) return [ri, ci]
        }
        return [-1, -1]
      }

      if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
        e.preventDefault()
        let [ri, ci] = findPosition(activeId)
        if (ri === -1) {
          setActiveId(panels[0].id)
          return
        }

        if (key === 'ArrowLeft') {
          ci = ci > 0 ? ci - 1 : rows[ri].length - 1
        } else if (key === 'ArrowRight') {
          ci = ci < rows[ri].length - 1 ? ci + 1 : 0
        } else if (key === 'ArrowUp') {
          ri = Math.max(0, ri - 1)
          ci = Math.min(ci, rows[ri].length - 1)
        } else if (key === 'ArrowDown') {
          ri = Math.min(rows.length - 1, ri + 1)
          ci = Math.min(ci, rows[ri].length - 1)
        }

        setActiveId(rows[ri][ci].id)
        return
      }

      if (!activeId) return

      if (key === 'f' || key === 'F') {
        e.preventDefault()
        setFocusedId(prev => (prev === activeId ? null : activeId))
      } else if (key === 't' || key === 'T') {
        e.preventDefault()
        panelRefs.current.get(activeId)?.toggleShell()
      } else if (key === 'x' || key === 'X') {
        e.preventDefault()
        removePanel(activeId)
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [panels, activeId, removePanel, groupsState, switchGroup, addGroup, closeGroup])

  return (
    <div className="-m-6 md:-m-8 p-4 h-[calc(100%+3rem)] md:h-[calc(100%+4rem)] flex flex-col gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
            <span className="material-symbols-outlined text-[16px]">article</span>
            <span>Logs</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Multi-Pod Logs</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Stream logs from multiple pods side-by-side
          </p>
        </div>
        <div className="flex items-center gap-2">
          {panels.length > 0 && (
            <Button variant="outline" onClick={resetPanels}>
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              Reset
            </Button>
          )}
          <Button onClick={() => setSearchOpen(true)}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Pods
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 border-b border-border-light dark:border-border-dark overflow-x-auto">
        {groupsState.groups.map((group, i) => (
          <GroupTab
            key={group.id}
            group={group}
            active={group.id === groupsState.activeGroupId}
            index={i}
            isOnly={groupsState.groups.length === 1}
            editing={renamingGroupId === group.id}
            onSelect={() => switchGroup(group.id)}
            onStartRename={() => setRenamingGroupId(group.id)}
            onRename={(name) => renameGroup(group.id, name)}
            onEditDone={() => setRenamingGroupId(null)}
            onDuplicate={() => duplicateGroup(group.id)}
            onClose={() => closeGroup(group.id)}
            onReorder={reorderGroup}
          />
        ))}
        <button
          onClick={addGroup}
          className="flex items-center justify-center size-7 rounded-t-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-hover/50 transition-colors"
          title="New group (N)"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
        </button>
      </div>

      {(panels.length > 0 || groupsState.groups.length > 1) && (
        <div className="flex items-center gap-4 shrink-0 flex-wrap">
          {HOTKEYS.map(({ key, label }) => (
            <span key={key} className="text-[11px] text-slate-500 dark:text-slate-500 flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-border-light dark:border-border-dark bg-slate-100 dark:bg-surface-highlight text-slate-500 dark:text-slate-400 font-mono text-[10px] leading-none">{key}</kbd>
              {label}
            </span>
          ))}
        </div>
      )}

      <div className="flex-1 relative min-h-0">
        {panels.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 dark:bg-surface-highlight flex items-center justify-center">
                <span className="material-symbols-outlined text-[32px] text-slate-400">article</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No log streams</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Add pods to start streaming their logs
                </p>
              </div>
              <Button onClick={() => setSearchOpen(true)}>
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add Pods
              </Button>
            </div>
          </div>
        )}
        {groupsState.groups.map(group => {
          const isActive = group.id === groupsState.activeGroupId
          if (group.panels.length === 0) return null
          return (
            <div
              key={group.id}
              className="absolute inset-0 flex flex-col"
              style={{ visibility: isActive ? 'visible' : 'hidden', zIndex: isActive ? 1 : 0 }}
            >
              <ResizableGrid
                panels={group.panels}
                focusedId={isActive ? focusedId : null}
                activeId={isActive ? activeId : null}
                panelRefs={panelRefs}
                onClose={removePanel}
                onContainerChange={handleContainerChange}
                onFocus={handleFocus}
                onActivate={setActiveId}
              />
            </div>
          )
        })}
      </div>

      <LogPodSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={addPanels}
      />
    </div>
  )
}
