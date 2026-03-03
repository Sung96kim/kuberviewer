import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { stringify as yamlStringify, parse as yamlParse } from 'yaml'
import { api } from '#/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'

type DiffEntry = {
  type: 'same' | 'add' | 'remove'
  line: string
}

function computeDiff(oldText: string, newText: string): DiffEntry[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const oldLen = oldLines.length
  const newLen = newLines.length

  const dp: number[][] = Array.from({ length: oldLen + 1 }, () =>
    Array.from({ length: newLen + 1 }, () => 0)
  )

  for (let i = 1; i <= oldLen; i++) {
    for (let j = 1; j <= newLen; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const entries: DiffEntry[] = []
  let i = oldLen
  let j = newLen

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      entries.push({ type: 'same', line: oldLines[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      entries.push({ type: 'add', line: newLines[j - 1] })
      j--
    } else {
      entries.push({ type: 'remove', line: oldLines[i - 1] })
      i--
    }
  }

  return entries.reverse()
}

type DiffStats = {
  additions: number
  deletions: number
}

function getDiffStats(entries: DiffEntry[]): DiffStats {
  let additions = 0
  let deletions = 0
  for (const entry of entries) {
    if (entry.type === 'add') additions++
    if (entry.type === 'remove') deletions++
  }
  return { additions, deletions }
}

type SideBySideLine = {
  left: { lineNumber: number | null; text: string; type: 'same' | 'remove' | 'empty' }
  right: { lineNumber: number | null; text: string; type: 'same' | 'add' | 'empty' }
}

function buildSideBySideLines(entries: DiffEntry[]): SideBySideLine[] {
  const lines: SideBySideLine[] = []
  let leftNum = 0
  let rightNum = 0
  let idx = 0

  while (idx < entries.length) {
    const entry = entries[idx]

    if (entry.type === 'same') {
      leftNum++
      rightNum++
      lines.push({
        left: { lineNumber: leftNum, text: entry.line, type: 'same' },
        right: { lineNumber: rightNum, text: entry.line, type: 'same' },
      })
      idx++
    } else if (entry.type === 'remove') {
      const removals: DiffEntry[] = []
      while (idx < entries.length && entries[idx].type === 'remove') {
        removals.push(entries[idx])
        idx++
      }
      const additions: DiffEntry[] = []
      while (idx < entries.length && entries[idx].type === 'add') {
        additions.push(entries[idx])
        idx++
      }

      const maxLen = Math.max(removals.length, additions.length)
      for (let k = 0; k < maxLen; k++) {
        const removal = removals[k]
        const addition = additions[k]
        lines.push({
          left: removal
            ? { lineNumber: ++leftNum, text: removal.line, type: 'remove' }
            : { lineNumber: null, text: '', type: 'empty' },
          right: addition
            ? { lineNumber: ++rightNum, text: addition.line, type: 'add' }
            : { lineNumber: null, text: '', type: 'empty' },
        })
      }
    } else {
      rightNum++
      lines.push({
        left: { lineNumber: null, text: '', type: 'empty' },
        right: { lineNumber: rightNum, text: entry.line, type: 'add' },
      })
      idx++
    }
  }

  return lines
}

const LINE_BG: Record<string, string> = {
  same: '',
  remove: 'bg-red-500/15',
  add: 'bg-emerald-500/15',
  empty: 'bg-[#1a1a1a]',
}

const LINE_NUM_COLOR: Record<string, string> = {
  same: 'text-slate-600',
  remove: 'text-red-400/70',
  add: 'text-emerald-400/70',
  empty: '',
}

type ApplyStatus = 'idle' | 'applying' | 'success' | 'error'

type YAMLDiffModalProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  originalYaml: string
  modifiedYaml: string
  resourceName: string
  isApplying: boolean
  applyStatus: ApplyStatus
  applyError: string | null
}

function YAMLDiffModal({ open, onClose, onConfirm, originalYaml, modifiedYaml, resourceName, isApplying, applyStatus, applyError }: YAMLDiffModalProps) {
  const diffEntries = useMemo(() => computeDiff(originalYaml, modifiedYaml), [originalYaml, modifiedYaml])
  const sideBySide = useMemo(() => buildSideBySideLines(diffEntries), [diffEntries])
  const stats = useMemo(() => getDiffStats(diffEntries), [diffEntries])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !isApplying) onClose() }}>
      <DialogContent className="sm:max-w-[90vw] lg:max-w-7xl max-h-[85vh] flex flex-col bg-[#1e1e1e] border-[#333] p-0 gap-0" showCloseButton={false}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#333] shrink-0">
          <DialogTitle className="text-white text-lg font-bold">Confirm Changes</DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            Review the changes before applying to <span className="text-slate-200 font-medium">{resourceName}</span>
          </DialogDescription>
        </DialogHeader>

        {applyStatus === 'applying' && (
          <div className="px-6 py-3 border-b border-[#333] shrink-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-blue-400 text-[18px] animate-spin">progress_activity</span>
              <span className="text-sm text-blue-400 font-medium">Applying changes...</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#333] overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {applyStatus === 'success' && (
          <div className="px-6 py-3 border-b border-emerald-500/20 bg-emerald-500/5 shrink-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
              <span className="text-sm text-emerald-400 font-medium">Changes applied successfully</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#333] overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: '100%' }} />
            </div>
          </div>
        )}

        {applyStatus === 'error' && applyError && (
          <div className="px-6 py-3 border-b border-red-500/20 bg-red-500/5 shrink-0">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-red-400 text-[18px]">error</span>
              <span className="text-sm text-red-400 font-medium">{applyError}</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="grid grid-cols-2 border-b border-[#333] shrink-0">
            <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wide border-r border-[#333]">
              Current Revision
            </div>
            <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
              New Revision
            </div>
          </div>

          <div className="flex-1 overflow-auto min-h-0">
            <div className="font-mono text-xs leading-6">
              {sideBySide.map((row, idx) => (
                <div key={idx} className="grid grid-cols-2">
                  <div className={`flex border-r border-[#333] ${LINE_BG[row.left.type]}`}>
                    <span className={`w-12 shrink-0 text-right pr-3 select-none ${LINE_NUM_COLOR[row.left.type]}`}>
                      {row.left.lineNumber ?? ''}
                    </span>
                    <span className={`flex-1 pl-2 pr-4 whitespace-pre-wrap break-all ${row.left.type === 'remove' ? 'text-red-300' : 'text-[#d4d4d4]'}`}>
                      {row.left.text}
                    </span>
                  </div>
                  <div className={`flex ${LINE_BG[row.right.type]}`}>
                    <span className={`w-12 shrink-0 text-right pr-3 select-none ${LINE_NUM_COLOR[row.right.type]}`}>
                      {row.right.lineNumber ?? ''}
                    </span>
                    <span className={`flex-1 pl-2 pr-4 whitespace-pre-wrap break-all ${row.right.type === 'add' ? 'text-emerald-300' : 'text-[#d4d4d4]'}`}>
                      {row.right.text}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-[#333] shrink-0 sm:justify-between">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-emerald-400 font-medium">+{stats.additions} Addition{stats.additions !== 1 ? 's' : ''}</span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-red-400 font-medium">-{stats.deletions} Deletion{stats.deletions !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            {applyStatus === 'success' ? (
              <Button onClick={onClose} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Done
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={onClose} disabled={isApplying} className="border-[#444] text-slate-300 hover:bg-[#333]">
                  Cancel
                </Button>
                <Button onClick={onConfirm} disabled={isApplying} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {isApplying ? 'Applying...' : 'Confirm Deployment'}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type ResourceYAMLEditorProps = {
  resource: Record<string, unknown>
  group: string
  version: string
  resourceType: string
  namespaced: boolean
  namespace?: string
}

export function ResourceYAMLEditor({ resource, group, version, resourceType, namespaced, namespace }: ResourceYAMLEditorProps) {
  const [format, setFormat] = useState<'yaml' | 'json'>('yaml')
  const [copied, setCopied] = useState(false)
  const [showDiffModal, setShowDiffModal] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [applyStatus, setApplyStatus] = useState<ApplyStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const originalContent = useMemo(() => {
    return format === 'yaml'
      ? yamlStringify(resource, { indent: 2, lineWidth: 0 })
      : JSON.stringify(resource, null, 2)
  }, [resource, format])

  const [editedContent, setEditedContent] = useState(originalContent)
  const userEditedRef = useRef(false)

  useEffect(() => {
    if (!userEditedRef.current) {
      setEditedContent(originalContent)
    }
  }, [originalContent])

  const resourceName = (resource as { metadata?: { name?: string } }).metadata?.name ?? 'resource'
  const hasChanges = editedContent !== originalContent

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(editedContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [editedContent])

  const handleApplyClick = useCallback(() => {
    setError(null)
    setApplyStatus('idle')
    setShowDiffModal(true)
  }, [])

  const handleCloseDiffModal = useCallback(() => {
    setShowDiffModal(false)
    setApplyStatus('idle')
  }, [])

  const handleConfirmApply = useCallback(async () => {
    setIsApplying(true)
    setApplyStatus('applying')
    setError(null)
    try {
      let parsed: unknown
      if (format === 'yaml') {
        parsed = yamlParse(editedContent)
      } else {
        parsed = JSON.parse(editedContent)
      }

      await api.applyResource({
        group,
        version,
        name: resourceType,
        namespaced,
        namespace,
        resourceName,
        body: parsed,
      })

      userEditedRef.current = false
      setApplyStatus('success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to apply resource'
      setError(message)
      setApplyStatus('error')
    } finally {
      setIsApplying(false)
    }
  }, [format, editedContent, group, version, resourceType, namespaced, namespace, resourceName])

  const handleReset = useCallback(() => {
    userEditedRef.current = false
    setEditedContent(originalContent)
    setError(null)
  }, [originalContent])

  return (
    <>
      <div className="bg-[#1e1e1e] rounded-xl border border-border-light dark:border-border-dark overflow-hidden flex flex-col">
        <div className="h-12 bg-[#252526] border-b border-[#333] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className={`material-symbols-outlined text-[20px] ${hasChanges ? 'text-yellow-500' : 'text-emerald-500'}`}>
              {hasChanges ? 'edit_note' : 'check_circle'}
            </span>
            <span className="text-sm font-mono text-slate-300">
              {resourceName}.{format}
            </span>
            {hasChanges && (
              <span className="text-xs text-yellow-500 font-medium">modified</span>
            )}
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
            {hasChanges && (
              <>
                <div className="h-4 w-px bg-[#444]" />
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-[#333] text-slate-300 text-xs font-medium transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">undo</span>
                  Reset
                </button>
                <button
                  onClick={handleApplyClick}
                  className="flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
                  Apply
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2">
            <span className="material-symbols-outlined text-red-400 text-[16px]">error</span>
            <span className="text-xs text-red-400">{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-auto max-h-[70vh] bg-[#1e1e1e]">
          <textarea
            value={editedContent}
            onChange={(e) => { userEditedRef.current = true; setEditedContent(e.target.value) }}
            spellCheck={false}
            className="w-full h-full min-h-[70vh] p-4 font-mono text-xs leading-6 text-[#d4d4d4] bg-transparent resize-none outline-none whitespace-pre"
          />
        </div>
      </div>

      <YAMLDiffModal
        open={showDiffModal}
        onClose={handleCloseDiffModal}
        onConfirm={handleConfirmApply}
        originalYaml={originalContent}
        modifiedYaml={editedContent}
        resourceName={resourceName}
        isApplying={isApplying}
        applyStatus={applyStatus}
        applyError={error}
      />
    </>
  )
}
