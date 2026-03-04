import { useState, useCallback, memo } from 'react'

type SecretDataTabProps = {
  resource: Record<string, unknown>
}

export const SecretDataTab = memo(function SecretDataTab({ resource }: SecretDataTabProps) {
  const secretType = (resource as { type?: string }).type ?? 'Opaque'
  const data = (resource.data ?? {}) as Record<string, string>
  const stringData = (resource.stringData ?? {}) as Record<string, string>
  const allEntries = { ...stringData, ...data }
  const entries = Object.entries(allEntries)
  const [dismissed, setDismissed] = useState(false)

  return (
    <div className="space-y-6">
      {!dismissed && entries.length > 0 && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <span className="material-symbols-outlined text-[20px] text-amber-500 mt-0.5">warning</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-400">Warning: Sensitive Information</p>
            <p className="text-xs text-slate-400 mt-0.5">
              You are viewing sensitive secret data. Values shown here grant access to critical systems.
              Ensure you are in a secure environment before revealing any values.
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-xs text-amber-500 hover:text-amber-400 font-medium shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">
          <h3 className="text-base font-bold">Data ({entries.length} {entries.length === 1 ? 'entry' : 'entries'})</h3>
          <span className="text-xs text-slate-600 dark:text-slate-500 font-mono">{secretType}</span>
        </div>
        {entries.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-400 dark:text-slate-600 mb-2 block">key_off</span>
            <p className="text-sm text-slate-600 dark:text-slate-400">No data entries</p>
          </div>
        ) : (
          <div className="divide-y divide-border-light dark:divide-border-dark">
            {entries.map(([key, value]) => (
              <SecretEntry key={key} name={key} base64Value={value} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

function SecretEntry({ name, base64Value }: { name: string; base64Value: string }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  const decodedValue = useCallback(() => {
    if (!base64Value) return '[empty]'
    try {
      return atob(base64Value)
    } catch {
      return '[invalid base64]'
    }
  }, [base64Value])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(decodedValue())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [decodedValue])

  const byteLength = base64Value ? Math.ceil(base64Value.length * 3 / 4) : 0
  const maskLength = Math.min(Math.max(byteLength, 8), 30)

  return (
    <div className="px-6 py-4 flex items-center gap-4">
      <div className="flex items-center gap-2 w-40 shrink-0">
        <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500">key</span>
        <span className="text-sm font-medium text-slate-900 dark:text-white truncate" title={name}>{name}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-50 dark:bg-background-dark border border-border-light dark:border-border-dark font-mono text-sm">
          {revealed ? (
            <span className="text-slate-700 dark:text-slate-300 break-all flex-1">{decodedValue()}</span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 flex-1 select-none">{'•'.repeat(maskLength)}</span>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setRevealed(!revealed)}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-surface-hover text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              title={revealed ? 'Hide' : 'Reveal'}
            >
              <span className="material-symbols-outlined text-[16px]">
                {revealed ? 'visibility_off' : 'visibility'}
              </span>
            </button>
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-surface-hover text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              title="Copy decoded value"
            >
              <span className="material-symbols-outlined text-[16px]">
                {copied ? 'check' : 'content_copy'}
              </span>
            </button>
          </div>
        </div>
      </div>

      <span className="text-xs text-slate-600 dark:text-slate-500 shrink-0 w-16 text-right">{byteLength} bytes</span>
    </div>
  )
}
