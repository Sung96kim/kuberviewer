import { useRef, useCallback, useState, type ReactNode } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from '#/components/ui/tooltip'

type TruncatedCellProps = {
  children: ReactNode
  className?: string
}

export function TruncatedCell({ children, className = '' }: TruncatedCellProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  const handleMouseEnter = useCallback(() => {
    const el = ref.current
    if (el && el.scrollWidth > el.clientWidth) {
      setOpen(true)
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    setOpen(false)
  }, [])

  return (
    <Tooltip open={open}>
      <TooltipTrigger asChild>
        <div
          ref={ref}
          className={`truncate ${className}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {children}
        </div>
      </TooltipTrigger>
      {open && (
        <TooltipContent side="top" className="max-w-sm break-all">
          {ref.current?.textContent}
        </TooltipContent>
      )}
    </Tooltip>
  )
}
