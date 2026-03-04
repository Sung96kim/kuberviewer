import { useTheme } from '#/hooks/use-theme'
import { useState } from 'react'
import { usePollingSpeed, type PollingSpeed } from '#/hooks/use-polling'
import { useSettings } from '#/hooks/use-settings'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'

const POLLING_OPTIONS: { value: PollingSpeed; label: string; icon: string; color: string; activeColor: string }[] = [
  { value: 'fast', label: 'Fast', icon: 'bolt', color: 'text-blue-400', activeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { value: 'normal', label: 'Normal', icon: 'play_arrow', color: 'text-emerald-400', activeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { value: 'slow', label: 'Slow', icon: 'slow_motion_video', color: 'text-yellow-400', activeColor: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  { value: 'paused', label: 'Paused', icon: 'pause', color: 'text-red-400', activeColor: 'bg-red-500/15 text-red-400 border-red-500/30' },
  { value: 'custom', label: 'Custom', icon: 'tune', color: 'text-purple-400', activeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
]

const WINDOW_OPTIONS = [15, 30, 60] as const
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 px-1 pt-3 pb-1.5 first:pt-0">
      {children}
    </div>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-1">
      <span className="text-xs text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-slate-300 dark:bg-surface-hover'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  )
}

export function SettingsPopover() {
  const { theme, toggleTheme } = useTheme()
  const { speed, setSpeed, customIntervalMs, setCustomIntervalMs } = usePollingSpeed()
  const [customInput, setCustomInput] = useState(String(customIntervalMs / 1000))
  const { settings, updateSetting } = useSettings()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-hover text-slate-500 dark:text-slate-400 transition-colors"
          title="Settings"
        >
          <span className="material-symbols-outlined">settings</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <SectionLabel>Appearance</SectionLabel>
        <div className="flex gap-1 px-1">
          <button
            onClick={() => theme === 'dark' && toggleTheme()}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              theme === 'light'
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-hover'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">light_mode</span>
            Light
          </button>
          <button
            onClick={() => theme === 'light' && toggleTheme()}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              theme === 'dark'
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-hover'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">dark_mode</span>
            Dark
          </button>
        </div>

        <div className="my-2.5 border-t border-border-light dark:border-border-dark" />

        <SectionLabel>Polling</SectionLabel>
        <div className="flex gap-1 px-1">
          {POLLING_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSpeed(opt.value)}
              className={`flex-1 flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg text-[10px] font-medium border transition-colors ${
                speed === opt.value
                  ? opt.activeColor
                  : `border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-hover`
              }`}
              title={opt.label}
            >
              <span className={`material-symbols-outlined text-[16px] ${speed === opt.value ? '' : opt.color}`}>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
        {speed === 'custom' && (
          <div className="flex items-center gap-2 px-1 mt-2">
            <input
              type="number"
              min={1}
              step={1}
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onBlur={() => {
                const secs = Math.max(1, Number(customInput) || 10)
                setCustomInput(String(secs))
                setCustomIntervalMs(secs * 1000)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
              className="w-20 text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-surface-highlight border border-border-light dark:border-border-dark outline-none text-right"
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">seconds</span>
          </div>
        )}

        <div className="my-2.5 border-t border-border-light dark:border-border-dark" />

        <SectionLabel>Notifications</SectionLabel>
        <SettingRow label="Enabled">
          <Toggle checked={settings.notificationsEnabled} onChange={v => updateSetting('notificationsEnabled', v)} />
        </SettingRow>
        <SettingRow label="Time window">
          <select
            value={settings.notificationWindowMinutes}
            onChange={e => updateSetting('notificationWindowMinutes', Number(e.target.value) as 15 | 30 | 60)}
            className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-surface-highlight border border-border-light dark:border-border-dark outline-none"
          >
            {WINDOW_OPTIONS.map(m => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </select>
        </SettingRow>

        <div className="my-2.5 border-t border-border-light dark:border-border-dark" />

        <SectionLabel>Display</SectionLabel>
        <SettingRow label="Compact mode">
          <Toggle checked={settings.compactMode} onChange={v => updateSetting('compactMode', v)} />
        </SettingRow>
        <SettingRow label="Auto-collapse sidebar">
          <Toggle checked={settings.sidebarAutoCollapse} onChange={v => updateSetting('sidebarAutoCollapse', v)} />
        </SettingRow>
        <SettingRow label="Default namespace">
          <input
            type="text"
            value={settings.defaultNamespace}
            onChange={e => updateSetting('defaultNamespace', e.target.value)}
            placeholder="default"
            className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-surface-highlight border border-border-light dark:border-border-dark outline-none w-24 text-right"
          />
        </SettingRow>
        <SettingRow label="Results per page">
          <select
            value={settings.pageSize}
            onChange={e => updateSetting('pageSize', Number(e.target.value) as 10 | 20 | 50 | 100)}
            className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-surface-highlight border border-border-light dark:border-border-dark outline-none"
          >
            {PAGE_SIZE_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </SettingRow>
      </PopoverContent>
    </Popover>
  )
}
