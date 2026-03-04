import { describe, it, expect, vi, afterEach } from 'vitest'
import { relativeTime } from '../time'

describe('relativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function freezeAt(iso: string) {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(iso))
  }

  it('returns seconds for < 1 minute', () => {
    freezeAt('2024-01-01T00:00:30Z')
    expect(relativeTime('2024-01-01T00:00:00Z')).toBe('30s')
  })

  it('returns minutes for < 1 hour', () => {
    freezeAt('2024-01-01T00:05:00Z')
    expect(relativeTime('2024-01-01T00:00:00Z')).toBe('5m')
  })

  it('returns hours and minutes', () => {
    freezeAt('2024-01-01T02:30:00Z')
    expect(relativeTime('2024-01-01T00:00:00Z')).toBe('2h 30m')
  })

  it('returns hours only when no remaining minutes', () => {
    freezeAt('2024-01-01T03:00:00Z')
    expect(relativeTime('2024-01-01T00:00:00Z')).toBe('3h')
  })

  it('returns days and hours', () => {
    freezeAt('2024-01-03T05:00:00Z')
    expect(relativeTime('2024-01-01T00:00:00Z')).toBe('2d 5h')
  })

  it('returns days only when no remaining hours', () => {
    freezeAt('2024-01-04T00:00:00Z')
    expect(relativeTime('2024-01-01T00:00:00Z')).toBe('3d')
  })

  it('returns "just now" for future timestamps', () => {
    freezeAt('2024-01-01T00:00:00Z')
    expect(relativeTime('2024-01-01T00:01:00Z')).toBe('just now')
  })

  it('returns 0s for same timestamp', () => {
    freezeAt('2024-01-01T00:00:00Z')
    expect(relativeTime('2024-01-01T00:00:00Z')).toBe('0s')
  })
})
