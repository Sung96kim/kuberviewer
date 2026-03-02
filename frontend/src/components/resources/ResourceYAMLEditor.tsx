import { useState, useCallback } from 'react'
import { stringify as yamlStringify } from 'yaml'

type ResourceYAMLEditorProps = {
  resource: Record<string, unknown>
}

export function ResourceYAMLEditor({ resource }: ResourceYAMLEditorProps) {
  const [format, setFormat] = useState<'yaml' | 'json'>('yaml')
  const [copied, setCopied] = useState(false)

  const content = format === 'yaml'
    ? yamlStringify(resource, { indent: 2, lineWidth: 0 })
    : JSON.stringify(resource, null, 2)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [content])

  return (
    <div className="bg-[#1e1e1e] rounded-xl border border-border-light dark:border-border-dark overflow-hidden flex flex-col">
      <div className="h-12 bg-[#252526] border-b border-[#333] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-emerald-500 text-[20px]">check_circle</span>
          <span className="text-sm font-mono text-slate-300">
            {(resource as { metadata?: { name?: string } }).metadata?.name ?? 'resource'}.{format}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#333] rounded p-0.5">
            <button
              onClick={() => setFormat('yaml')}
              className={`px-3 py-1 text-xs font-bold rounded ${format === 'yaml' ? 'bg-[#444] text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              YAML
            </button>
            <button
              onClick={() => setFormat('json')}
              className={`px-3 py-1 text-xs font-bold rounded ${format === 'json' ? 'bg-[#444] text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              JSON
            </button>
          </div>
          <div className="h-4 w-px bg-[#444]" />
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-[#333] text-slate-300 text-xs font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">
              {copied ? 'check' : 'content_copy'}
            </span>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto max-h-[70vh] bg-[#1e1e1e]">
        <pre className="p-4 font-mono text-xs leading-6 text-[#d4d4d4] whitespace-pre">
          {content}
        </pre>
      </div>
    </div>
  )
}
