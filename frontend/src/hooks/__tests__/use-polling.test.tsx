import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { PollingProvider, usePollingSpeed, usePollingInterval } from '../use-polling'

function wrapper({ children }: { children: ReactNode }) {
  return <PollingProvider>{children}</PollingProvider>
}

describe('usePollingSpeed', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to normal speed', () => {
    const { result } = renderHook(() => usePollingSpeed(), { wrapper })
    expect(result.current.speed).toBe('normal')
  })

  it('loads speed from localStorage', () => {
    localStorage.setItem('kuberviewer:polling-speed', 'fast')
    const { result } = renderHook(() => usePollingSpeed(), { wrapper })
    expect(result.current.speed).toBe('fast')
  })

  it('changes speed', () => {
    const { result } = renderHook(() => usePollingSpeed(), { wrapper })
    act(() => result.current.setSpeed('slow'))
    expect(result.current.speed).toBe('slow')
  })

  it('persists speed to localStorage', () => {
    const { result } = renderHook(() => usePollingSpeed(), { wrapper })
    act(() => result.current.setSpeed('paused'))
    expect(localStorage.getItem('kuberviewer:polling-speed')).toBe('paused')
  })

  it('loads custom interval from localStorage', () => {
    localStorage.setItem('kuberviewer:polling-custom-ms', '5000')
    const { result } = renderHook(() => usePollingSpeed(), { wrapper })
    expect(result.current.customIntervalMs).toBe(5000)
  })

  it('defaults custom interval to 10000 for invalid values', () => {
    localStorage.setItem('kuberviewer:polling-custom-ms', '500')
    const { result } = renderHook(() => usePollingSpeed(), { wrapper })
    expect(result.current.customIntervalMs).toBe(10_000)
  })

  it('ignores invalid speed in localStorage', () => {
    localStorage.setItem('kuberviewer:polling-speed', 'turbo')
    const { result } = renderHook(() => usePollingSpeed(), { wrapper })
    expect(result.current.speed).toBe('normal')
  })
})

describe('usePollingInterval', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns base interval at normal speed (1x)', () => {
    const { result } = renderHook(() => usePollingInterval(10_000), { wrapper })
    expect(result.current).toBe(10_000)
  })

  it('returns halved interval at fast speed (0.5x)', () => {
    localStorage.setItem('kuberviewer:polling-speed', 'fast')
    const { result } = renderHook(() => usePollingInterval(10_000), { wrapper })
    expect(result.current).toBe(5_000)
  })

  it('returns tripled interval at slow speed (3x)', () => {
    localStorage.setItem('kuberviewer:polling-speed', 'slow')
    const { result } = renderHook(() => usePollingInterval(10_000), { wrapper })
    expect(result.current).toBe(30_000)
  })

  it('returns false when paused', () => {
    localStorage.setItem('kuberviewer:polling-speed', 'paused')
    const { result } = renderHook(() => usePollingInterval(10_000), { wrapper })
    expect(result.current).toBe(false)
  })

  it('returns custom interval when speed is custom', () => {
    localStorage.setItem('kuberviewer:polling-speed', 'custom')
    localStorage.setItem('kuberviewer:polling-custom-ms', '7000')
    const { result } = renderHook(() => usePollingInterval(10_000), { wrapper })
    expect(result.current).toBe(7000)
  })
})
