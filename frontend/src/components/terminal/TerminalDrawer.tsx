import { useState, useCallback, useRef, useEffect, memo } from 'react'
import { useTerminal } from './TerminalProvider'
import { TerminalSessionView } from './TerminalSession'
import { PodSearchDialog } from './PodSearchDialog'

const MIN_HEIGHT = 200
const DEFAULT_HEIGHT = 350
const MAX_HEIGHT_RATIO = 0.8

export const TerminalDrawer = memo(function TerminalDrawer() {
  const {
    groups,
    activeGroupId,
    isOpen,
    splitPane,
    closePane,
    closeGroup,
    setActiveGroup,
    setActivePane,
    closeDrawer,
  } = useTerminal()

  const [podSearchOpen, setPodSearchOpen] = useState(false)
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startY.current = e.clientY
    startHeight.current = height
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [height])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = startY.current - e.clientY
      const maxHeight = window.innerHeight * MAX_HEIGHT_RATIO
      setHeight(Math.min(maxHeight, Math.max(MIN_HEIGHT, startHeight.current + delta)))
    }

    const handleMouseUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  if (!isOpen || groups.length === 0) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-slate-50 dark:bg-[#0f172a] border-t border-border-light dark:border-slate-700 flex flex-col shadow-[0_-4px_24px_rgba(0,0,0,0.15)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.5)] rounded-t-xl"
      style={{ height }}
    >
      <div
        className="h-1.5 cursor-row-resize hover:bg-primary/30 transition-colors shrink-0"
        onMouseDown={handleMouseDown}
      >
        <div className="w-10 h-0.5 bg-slate-300 dark:bg-slate-600 rounded mx-auto mt-0.5" />
      </div>

      <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-900/80 border-b border-border-light dark:border-slate-700 shrink-0 overflow-x-auto">
        <span className="material-symbols-outlined text-[16px] text-slate-500 mr-1">terminal</span>
        {groups.map((group) => (
          <div
            key={group.id}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs cursor-pointer transition-colors group/tab ${
              activeGroupId === group.id
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
            onClick={() => setActiveGroup(group.id)}
          >
            <span className="truncate max-w-[150px]">{group.label}</span>
            {group.panes.length > 1 && (
              <span className="text-slate-500 text-[10px]">[{group.panes.length}]</span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                closeGroup(group.id)
              }}
              className="opacity-0 group-hover/tab:opacity-100 hover:text-red-400 transition-opacity"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setPodSearchOpen(true)}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="New Terminal"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
          </button>
          <button
            onClick={splitPane}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Split Terminal"
          >
            <span className="material-symbols-outlined text-[16px]">vertical_split</span>
          </button>
          <button
            onClick={closeDrawer}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Minimize"
          >
            <span className="material-symbols-outlined text-[16px]">keyboard_arrow_down</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {groups.map((group) => (
          <div
            key={group.id}
            className="h-full"
            style={{ display: group.id === activeGroupId ? 'flex' : 'none' }}
          >
            {group.panes.map((pane, index) => (
              <div
                key={pane.id}
                className={`flex-1 flex flex-col min-w-0 ${
                  pane.id === group.activePaneId ? 'ring-1 ring-inset ring-primary/30' : ''
                }`}
                style={{ borderLeft: index > 0 ? '1px solid var(--color-border-light, rgb(51 65 85))' : undefined }}
                onClick={() => setActivePane(group.id, pane.id)}
              >
                {group.panes.length > 1 && (
                  <div className="flex items-center justify-between px-2 py-0.5 bg-slate-100 dark:bg-slate-900/60 border-b border-border-light dark:border-slate-700/50 shrink-0">
                    <span className="text-[10px] text-slate-500 truncate">{pane.label}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        closePane(group.id, pane.id)
                      }}
                      className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[12px]">close</span>
                    </button>
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <TerminalSessionView
                    namespace={pane.namespace}
                    pod={pane.pod}
                    container={pane.container}
                    isVisible={group.id === activeGroupId}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <PodSearchDialog open={podSearchOpen} onOpenChange={setPodSearchOpen} />
    </div>
  )
})
