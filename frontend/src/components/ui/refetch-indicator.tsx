import { useState, useEffect, useRef } from 'react'

const MIN_DISPLAY_MS = 800

export function RefetchIndicator({ fetching }: { fetching: boolean }) {
  const [visible, setVisible] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showStart = useRef(0)

  useEffect(() => {
    if (fetching) {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current)
        hideTimer.current = null
      }
      showStart.current = Date.now()
      setVisible(true)
    } else if (visible) {
      const elapsed = Date.now() - showStart.current
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed)
      hideTimer.current = setTimeout(() => {
        setVisible(false)
        hideTimer.current = null
      }, remaining)
    }

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [fetching])

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide transition-all duration-300 ${
        visible
          ? 'opacity-100 bg-primary/10 text-primary border border-primary/20'
          : 'opacity-0 bg-transparent text-transparent border border-transparent'
      }`}
    >
      <span
        className={`inline-block size-1.5 rounded-full bg-current ${visible ? 'animate-pulse' : ''}`}
      />
      Syncing
    </span>
  )
}
