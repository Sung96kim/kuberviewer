import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type PollingSpeed = 'fast' | 'normal' | 'slow' | 'paused' | 'custom'

const SPEED_MULTIPLIERS: Record<Exclude<PollingSpeed, 'custom'>, number | false> = {
  fast: 0.5,
  normal: 1,
  slow: 3,
  paused: false,
}

type PollingContextValue = {
  speed: PollingSpeed
  setSpeed: (speed: PollingSpeed) => void
  customIntervalMs: number
  setCustomIntervalMs: (ms: number) => void
}

const PollingContext = createContext<PollingContextValue>({
  speed: 'normal',
  setSpeed: () => {},
  customIntervalMs: 10_000,
  setCustomIntervalMs: () => {},
})

const SPEED_KEY = 'kuberviewer:polling-speed'
const CUSTOM_KEY = 'kuberviewer:polling-custom-ms'
const VALID_SPEEDS: PollingSpeed[] = ['fast', 'normal', 'slow', 'paused', 'custom']

function loadSpeed(): PollingSpeed {
  const stored = localStorage.getItem(SPEED_KEY)
  if (stored && VALID_SPEEDS.includes(stored as PollingSpeed)) return stored as PollingSpeed
  return 'normal'
}

function loadCustomInterval(): number {
  const stored = localStorage.getItem(CUSTOM_KEY)
  if (stored) {
    const parsed = Number(stored)
    if (parsed >= 1000) return parsed
  }
  return 10_000
}

export function PollingProvider({ children }: { children: ReactNode }) {
  const [speed, setSpeed] = useState<PollingSpeed>(loadSpeed)
  const [customIntervalMs, setCustomIntervalMs] = useState(loadCustomInterval)

  useEffect(() => {
    localStorage.setItem(SPEED_KEY, speed)
  }, [speed])

  useEffect(() => {
    localStorage.setItem(CUSTOM_KEY, String(customIntervalMs))
  }, [customIntervalMs])

  return (
    <PollingContext value={{ speed, setSpeed, customIntervalMs, setCustomIntervalMs }}>
      {children}
    </PollingContext>
  )
}

export function usePollingSpeed() {
  return useContext(PollingContext)
}

export function usePollingInterval(baseMs: number): number | false {
  const { speed, customIntervalMs } = useContext(PollingContext)
  if (speed === 'custom') return customIntervalMs
  const multiplier = SPEED_MULTIPLIERS[speed]
  if (multiplier === false) return false
  return Math.round(baseMs * multiplier)
}
