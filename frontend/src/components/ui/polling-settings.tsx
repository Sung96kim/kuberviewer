import { usePollingSpeed, type PollingSpeed } from '#/hooks/use-polling'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'

const SPEED_OPTIONS: {
  value: PollingSpeed
  label: string
  description: string
  icon: string
  color: string
  activeColor: string
}[] = [
  {
    value: 'fast',
    label: 'Fast',
    description: '2x faster',
    icon: 'bolt',
    color: 'text-blue-400',
    activeColor: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  },
  {
    value: 'normal',
    label: 'Normal',
    description: 'Default',
    icon: 'play_arrow',
    color: 'text-emerald-400',
    activeColor: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  },
  {
    value: 'slow',
    label: 'Slow',
    description: '3x slower',
    icon: 'slow_motion_video',
    color: 'text-yellow-400',
    activeColor: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  },
  {
    value: 'paused',
    label: 'Paused',
    description: 'No polling',
    icon: 'pause',
    color: 'text-red-400',
    activeColor: 'bg-red-500/10 border-red-500/30 text-red-400',
  },
]

const BADGE_STYLES: Record<PollingSpeed, string> = {
  fast: 'bg-blue-500/10 text-blue-400',
  normal: 'bg-emerald-500/10 text-emerald-400',
  slow: 'bg-yellow-500/10 text-yellow-400',
  paused: 'bg-red-500/10 text-red-400',
}

export function PollingSettings() {
  const { speed, setSpeed } = usePollingSpeed()
  const current = SPEED_OPTIONS.find((o) => o.value === speed)!

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
          title="Polling settings"
        >
          <span className="material-symbols-outlined text-[18px]">tune</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${BADGE_STYLES[speed]}`}>
            {current.label}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 px-2 py-1.5">
          Polling Speed
        </div>
        <div className="space-y-1">
          {SPEED_OPTIONS.map((option) => {
            const isActive = speed === option.value
            return (
              <button
                key={option.value}
                onClick={() => setSpeed(option.value)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors border ${
                  isActive
                    ? option.activeColor
                    : 'border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className={`material-symbols-outlined text-[18px] ${isActive ? '' : option.color}`}>
                  {option.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold">{option.label}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">{option.description}</div>
                </div>
                {isActive && (
                  <span className="material-symbols-outlined text-[16px]">check</span>
                )}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
