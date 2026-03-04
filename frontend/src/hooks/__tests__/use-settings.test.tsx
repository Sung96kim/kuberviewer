import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SettingsProvider, useSettings } from '../use-settings'

function wrapper({ children }: { children: ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>
}

describe('useSettings', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.dataset.compact = ''
  })

  it('returns default settings initially', () => {
    const { result } = renderHook(() => useSettings(), { wrapper })
    expect(result.current.settings).toEqual({
      notificationsEnabled: true,
      notificationWindowMinutes: 30,
      compactMode: false,
      defaultNamespace: 'default',
      sidebarAutoCollapse: false,
      pageSize: 20,
    })
  })

  it('loads settings from localStorage', () => {
    localStorage.setItem('kuberviewer:settings', JSON.stringify({
      compactMode: true,
      pageSize: 50,
    }))
    const { result } = renderHook(() => useSettings(), { wrapper })
    expect(result.current.settings.compactMode).toBe(true)
    expect(result.current.settings.pageSize).toBe(50)
    expect(result.current.settings.notificationsEnabled).toBe(true)
  })

  it('updates a single setting', () => {
    const { result } = renderHook(() => useSettings(), { wrapper })
    act(() => result.current.updateSetting('compactMode', true))
    expect(result.current.settings.compactMode).toBe(true)
  })

  it('persists settings to localStorage on update', () => {
    const { result } = renderHook(() => useSettings(), { wrapper })
    act(() => result.current.updateSetting('pageSize', 100))
    const stored = JSON.parse(localStorage.getItem('kuberviewer:settings')!)
    expect(stored.pageSize).toBe(100)
  })

  it('sets data-compact attribute when compact mode is toggled', () => {
    const { result } = renderHook(() => useSettings(), { wrapper })
    act(() => result.current.updateSetting('compactMode', true))
    expect(document.documentElement.dataset.compact).toBe('true')
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('kuberviewer:settings', 'not-json')
    const { result } = renderHook(() => useSettings(), { wrapper })
    expect(result.current.settings.notificationsEnabled).toBe(true)
  })
})
