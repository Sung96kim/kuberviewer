import { useState } from 'react'
import { useTerminal } from '#/components/terminal/TerminalProvider'
import { PodSearchDialog } from '#/components/terminal/PodSearchDialog'

export function TerminalFab() {
  const { groups, isOpen, toggleDrawer } = useTerminal()
  const [podSearchOpen, setPodSearchOpen] = useState(false)

  if (isOpen) return null

  const handleClick = () => {
    if (groups.length > 0) {
      toggleDrawer()
    } else {
      setPodSearchOpen(true)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-colors"
        title="Terminal"
      >
        <span className="material-symbols-outlined text-[24px]">terminal</span>
      </button>
      <PodSearchDialog open={podSearchOpen} onOpenChange={setPodSearchOpen} />
    </>
  )
}
