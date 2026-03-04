import { useState, useRef, useEffect, useCallback } from 'react'
import { useTerminal } from '#/components/terminal/TerminalProvider'
import { PodSearchDialog } from '#/components/terminal/PodSearchDialog'

type Side = 'left' | 'right'
const STORAGE_KEY = 'kuberviewer:fab-side'

function loadSide(): Side {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'left' || raw === 'right') return raw
  } catch {}
  return 'right'
}

export function TerminalFab() {
  const { groups, isOpen, toggleDrawer } = useTerminal()
  const [podSearchOpen, setPodSearchOpen] = useState(false)
  const [side, setSide] = useState<Side>(loadSide)
  const [dragging, setDragging] = useState(false)
  const [dragX, setDragX] = useState<number | null>(null)
  const dragRef = useRef<{ startX: number; moved: boolean } | null>(null)

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      e.preventDefault()
      const dx = Math.abs(e.clientX - drag.startX)
      if (!drag.moved && dx > 4) {
        drag.moved = true
        setDragging(true)
      }
      if (drag.moved) {
        setDragX(e.clientX)
      }
    }

    const onMouseUp = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      dragRef.current = null
      setDragging(false)
      setDragX(null)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (drag.moved) {
        const newSide: Side = e.clientX < window.innerWidth / 2 ? 'left' : 'right'
        setSide(newSide)
        localStorage.setItem(STORAGE_KEY, newSide)
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, moved: false }
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
  }, [])

  const handleClick = useCallback(() => {
    if (dragRef.current?.moved) return
    if (groups.length > 0) {
      toggleDrawer()
    } else {
      setPodSearchOpen(true)
    }
  }, [groups.length, toggleDrawer])

  if (isOpen) return null

  const positionClass = side === 'left' ? 'left-6' : 'right-6'

  return (
    <>
      {dragging && dragX !== null && (
        <div
          className="fixed z-50 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/80 text-white shadow-lg pointer-events-none"
          style={{ left: dragX - 24, bottom: 24 }}
        >
          <span className="material-symbols-outlined text-[24px]">terminal</span>
        </div>
      )}
      <button
        type="button"
        onMouseDown={onMouseDown}
        onClick={handleClick}
        className={`fixed bottom-6 ${positionClass} z-40 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all duration-300 cursor-grab active:cursor-grabbing ${dragging ? 'opacity-30' : ''}`}
        title="Terminal"
      >
        <span className="material-symbols-outlined text-[24px]">terminal</span>
      </button>
      <PodSearchDialog open={podSearchOpen} onOpenChange={setPodSearchOpen} />
    </>
  )
}
