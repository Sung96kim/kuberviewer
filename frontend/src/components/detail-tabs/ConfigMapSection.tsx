import { memo, useState } from 'react'

type ConfigMapSectionProps = {
  resource: Record<string, unknown>
}

export const ConfigMapSection = memo(function ConfigMapSection({ resource }: ConfigMapSectionProps) {
  const data = (resource.data ?? {}) as Record<string, string>
  const binaryData = (resource.binaryData ?? {}) as Record<string, string>
  const dataKeys = Object.keys(data)
  const binaryKeys = Object.keys(binaryData)
  const totalKeys = dataKeys.length + binaryKeys.length

  return (
    <div className="space-y-6">
      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">
          <h3 className="text-base font-bold">Data</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">{totalKeys} key{totalKeys !== 1 ? 's' : ''}</span>
        </div>
        {totalKeys === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No data entries
          </div>
        ) : (
          <div className="divide-y divide-border-light dark:divide-border-dark">
            {dataKeys.map((key) => (
              <ConfigMapEntry key={key} entryKey={key} value={data[key]} />
            ))}
            {binaryKeys.map((key) => (
              <div key={key} className="px-6 py-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400">file_present</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{key}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-surface-highlight text-slate-500 dark:text-slate-400">binary</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{binaryData[key].length} bytes (base64)</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

function ConfigMapEntry({ entryKey, value }: { entryKey: string; value: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = value.length > 200 || value.includes('\n')
  const lineCount = value.split('\n').length

  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400">description</span>
          <span className="text-sm font-medium text-slate-900 dark:text-white">{entryKey}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {lineCount > 1 ? `${lineCount} lines` : `${value.length} chars`}
          </span>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-primary hover:text-primary/80 font-medium"
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          )}
        </div>
      </div>
      <pre className={`text-xs font-mono bg-slate-100 dark:bg-surface-highlight rounded p-3 overflow-x-auto text-slate-700 dark:text-slate-300 border border-border-light dark:border-border-dark ${
        !expanded && isLong ? 'max-h-24 overflow-hidden' : ''
      }`}>
        {value}
      </pre>
    </div>
  )
}
