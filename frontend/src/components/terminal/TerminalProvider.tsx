import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'

export type TerminalPane = {
  id: string
  namespace: string
  pod: string
  container?: string
  label: string
}

export type TerminalGroup = {
  id: string
  label: string
  panes: TerminalPane[]
  activePaneId: string
}

type TerminalContextValue = {
  groups: TerminalGroup[]
  activeGroupId: string | null
  isOpen: boolean
  openSession: (params: { namespace: string; pod: string; container?: string }) => void
  splitPane: () => void
  closePane: (groupId: string, paneId: string) => void
  closeGroup: (groupId: string) => void
  setActiveGroup: (id: string) => void
  setActivePane: (groupId: string, paneId: string) => void
  toggleDrawer: () => void
  closeDrawer: () => void
}

const TerminalContext = createContext<TerminalContextValue | null>(null)

let counter = 0
function nextId(prefix: string) {
  return `${prefix}-${++counter}`
}

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<TerminalGroup[]>([])
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const openSession = useCallback(({ namespace, pod, container }: { namespace: string; pod: string; container?: string }) => {
    const groupId = nextId('group')
    const paneId = nextId('pane')
    const label = container ? `${pod}/${container}` : pod
    const pane: TerminalPane = { id: paneId, namespace, pod, container, label }
    const group: TerminalGroup = { id: groupId, label, panes: [pane], activePaneId: paneId }

    setGroups((prev) => [...prev, group])
    setActiveGroupId(groupId)
    setIsOpen(true)
  }, [])

  const splitPane = useCallback(() => {
    setActiveGroupId((currentGroupId) => {
      if (!currentGroupId) return currentGroupId
      setGroups((prev) => {
        const idx = prev.findIndex((g) => g.id === currentGroupId)
        if (idx === -1) return prev

        const group = prev[idx]
        const source = group.panes.find((p) => p.id === group.activePaneId) ?? group.panes[0]
        if (!source) return prev

        const newPaneId = nextId('pane')
        const newPane: TerminalPane = {
          id: newPaneId,
          namespace: source.namespace,
          pod: source.pod,
          container: source.container,
          label: source.label,
        }

        const updated = [...prev]
        updated[idx] = {
          ...group,
          panes: [...group.panes, newPane],
          activePaneId: newPaneId,
        }
        return updated
      })
      return currentGroupId
    })
  }, [])

  const closePane = useCallback((groupId: string, paneId: string) => {
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.id === groupId)
      if (idx === -1) return prev

      const group = prev[idx]
      const nextPanes = group.panes.filter((p) => p.id !== paneId)

      if (nextPanes.length === 0) {
        const nextGroups = prev.filter((g) => g.id !== groupId)
        if (nextGroups.length === 0) {
          setIsOpen(false)
          setActiveGroupId(null)
        } else {
          setActiveGroupId((current) =>
            current === groupId ? nextGroups[nextGroups.length - 1].id : current
          )
        }
        return nextGroups
      }

      const updated = [...prev]
      updated[idx] = {
        ...group,
        panes: nextPanes,
        activePaneId: group.activePaneId === paneId
          ? nextPanes[nextPanes.length - 1].id
          : group.activePaneId,
      }
      return updated
    })
  }, [])

  const closeGroup = useCallback((groupId: string) => {
    setGroups((prev) => {
      const next = prev.filter((g) => g.id !== groupId)
      if (next.length === 0) {
        setIsOpen(false)
        setActiveGroupId(null)
      } else {
        setActiveGroupId((current) =>
          current === groupId ? next[next.length - 1].id : current
        )
      }
      return next
    })
  }, [])

  const setActiveGroup = useCallback((id: string) => {
    setActiveGroupId(id)
  }, [])

  const setActivePane = useCallback((groupId: string, paneId: string) => {
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.id === groupId)
      if (idx === -1) return prev

      const group = prev[idx]
      if (group.activePaneId === paneId) return prev

      const updated = [...prev]
      updated[idx] = { ...group, activePaneId: paneId }
      return updated
    })
  }, [])

  const toggleDrawer = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  const closeDrawer = useCallback(() => {
    setIsOpen(false)
  }, [])

  const value = useMemo<TerminalContextValue>(() => ({
    groups,
    activeGroupId,
    isOpen,
    openSession,
    splitPane,
    closePane,
    closeGroup,
    setActiveGroup,
    setActivePane,
    toggleDrawer,
    closeDrawer,
  }), [groups, activeGroupId, isOpen, openSession, splitPane, closePane, closeGroup, setActiveGroup, setActivePane, toggleDrawer, closeDrawer])

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  )
}

export function useTerminal() {
  const ctx = useContext(TerminalContext)
  if (!ctx) throw new Error('useTerminal must be used within TerminalProvider')
  return ctx
}
