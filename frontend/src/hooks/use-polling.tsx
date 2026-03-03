import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type PollingSpeed = 'fast' | 'normal' | 'slow' | 'paused'

const SPEED_MULTIPLIERS: Record<PollingSpeed, number | false> = {
  fast: 0.5,
  normal: 1,
  slow: 3,
  paused: false,
}

type PollingContextValue = {
  speed: PollingSpeed
  setSpeed: (speed: PollingSpeed) => void
}

const PollingContext = createContext<PollingContextValue>({
  speed: 'normal',
  setSpeed: () => {},
})

const STORAGE_KEY = 'kuberviewer:polling-speed'
const VALID_SPEEDS: PollingSpeed[] = ['fast', 'normal', 'slow', 'paused']

function loadSpeed(): PollingSpeed {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && VALID_SPEEDS.includes(stored as PollingSpeed)) return stored as PollingSpeed
  return 'normal'
}

export function PollingProvider({ children }: { children: ReactNode }) {
  const [speed, setSpeed] = useState<PollingSpeed>(loadSpeed)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, speed)
  }, [speed])

  return (
    <PollingContext value={{ speed, setSpeed }}>
      {children}
    </PollingContext>
  )
}

export function usePollingSpeed() {
  return useContext(PollingContext)
}

export function usePollingInterval(baseMs: number): number | false {
  const { speed } = useContext(PollingContext)
  const multiplier = SPEED_MULTIPLIERS[speed]
  if (multiplier === false) return false
  return Math.round(baseMs * multiplier)
}
