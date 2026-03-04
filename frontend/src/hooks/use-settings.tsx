import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export type AppSettings = {
  notificationsEnabled: boolean
  notificationWindowMinutes: 15 | 30 | 60
  compactMode: boolean
  defaultNamespace: string
  sidebarAutoCollapse: boolean
  pageSize: 10 | 20 | 50 | 100
}

const DEFAULTS: AppSettings = {
  notificationsEnabled: true,
  notificationWindowMinutes: 30,
  compactMode: false,
  defaultNamespace: 'default',
  sidebarAutoCollapse: false,
  pageSize: 20,
}

const STORAGE_KEY = 'kuberviewer:settings'

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return { ...DEFAULTS, ...JSON.parse(stored) }
  } catch {}
  return DEFAULTS
}

type SettingsContextValue = {
  settings: AppSettings
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULTS,
  updateSetting: () => {},
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    document.documentElement.dataset.compact = settings.compactMode ? 'true' : ''
  }, [settings.compactMode])

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  return (
    <SettingsContext value={{ settings, updateSetting }}>
      {children}
    </SettingsContext>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
