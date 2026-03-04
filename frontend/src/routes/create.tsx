import { useState, useCallback, useMemo, useRef } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'
import { useAPIResources } from '#/hooks/use-api-resources'
import { useContexts } from '#/hooks/use-contexts'
import { Breadcrumb } from '#/components/layout/Breadcrumb'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { api } from '#/api'
import { useResourceList } from '#/hooks/use-resource-list'
import { TEMPLATES, NS_PLACEHOLDER, resolveResource } from '#/lib/resource-templates'
import {
  type SavedDefinition,
  loadSavedDefinitions,
  saveDefinition,
  renameDefinition,
  updateDefinition,
  removeDefinition,
} from '#/lib/saved-definitions'

export const Route = createFileRoute('/create')({ component: CreateResourcePage })

type ApplyStatus = 'idle' | 'applying' | 'success' | 'error'

function CreateResourcePage() {
  const navigate = useNavigate()
  const { data: apiData } = useAPIResources()
  const { data: ctxData, isLoading: ctxLoading } = useContexts()
  const { data: nsData } = useResourceList({ group: '', version: 'v1', name: 'namespaces', namespaced: false })
  const [selectedTemplate, setSelectedTemplate] = useState(0)
  const [namespace, setNamespace] = useState('default')
  const [content, setContent] = useState(TEMPLATES[0].yaml.replaceAll(NS_PLACEHOLDER, 'default'))
  const [status, setStatus] = useState<ApplyStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [savedDefs, setSavedDefs] = useState<SavedDefinition[]>(loadSavedDefinitions)
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const draftRef = useRef<Map<number, string>>(new Map())

  const allResources = useMemo(() => {
    if (!apiData?.groups) return []
    return apiData.groups.flatMap((g) => g.resources)
  }, [apiData])

  const namespaceNames = useMemo(() => {
    const items = (nsData as { items?: { metadata: { name: string } }[] })?.items ?? []
    return items.map((ns) => ns.metadata.name).sort()
  }, [nsData])

  const selectTemplate = useCallback((idx: number) => {
    setSelectedTemplate((prev) => {
      draftRef.current.set(prev, content)
      return idx
    })
    setActiveSavedId(null)
    const saved = draftRef.current.get(idx)
    setContent(saved ?? TEMPLATES[idx].yaml.replaceAll(NS_PLACEHOLDER, namespace))
    setStatus('idle')
    setError(null)
    setParseError(null)
  }, [namespace, content])

  const loadSaved = useCallback((def: SavedDefinition) => {
    if (selectedTemplate >= 0) {
      draftRef.current.set(selectedTemplate, content)
    }
    setSelectedTemplate(-1)
    setActiveSavedId(def.id)
    setContent(def.yaml)
    setStatus('idle')
    setError(null)
    setParseError(null)
  }, [selectedTemplate, content])

  const openSaveDialog = useCallback(() => {
    let name = ''
    try {
      const parsed = yamlParse(content)
      const kind = parsed?.kind as string | undefined
      const metaName = (parsed?.metadata as Record<string, unknown>)?.name as string | undefined
      if (kind && metaName) name = `${kind} - ${metaName}`
      else if (kind) name = kind
    } catch {}
    setSaveName(name)
    setSaveDialogOpen(true)
  }, [content])

  const handleSave = useCallback(() => {
    if (!saveName.trim()) return
    if (activeSavedId) {
      updateDefinition(activeSavedId, content)
      renameDefinition(activeSavedId, saveName.trim())
    } else {
      const entry = saveDefinition(saveName.trim(), content)
      setActiveSavedId(entry.id)
      setSelectedTemplate(-1)
    }
    setSavedDefs(loadSavedDefinitions())
    setSaveDialogOpen(false)
  }, [saveName, content, activeSavedId])

  const handleRenameSubmit = useCallback((id: string) => {
    if (!renameValue.trim()) return
    renameDefinition(id, renameValue.trim())
    setSavedDefs(loadSavedDefinitions())
    setRenamingId(null)
  }, [renameValue])

  const handleDelete = useCallback((id: string) => {
    removeDefinition(id)
    setSavedDefs(loadSavedDefinitions())
    if (activeSavedId === id) {
      setActiveSavedId(null)
      setSelectedTemplate(0)
      setContent(TEMPLATES[0].yaml.replaceAll(NS_PLACEHOLDER, namespace))
    }
  }, [activeSavedId, namespace])

  const handleContentChange = useCallback((value: string) => {
    setContent(value)
    setStatus('idle')
    setError(null)
    try {
      yamlParse(value)
      setParseError(null)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid YAML')
    }
  }, [])

  const handleNamespaceChange = useCallback((ns: string) => {
    setNamespace(ns)
    setContent((prev) => {
      try {
        const parsed = yamlParse(prev)
        if (parsed?.metadata) {
          parsed.metadata.namespace = ns
          return yamlStringify(parsed, { indent: 2, lineWidth: 0 })
        }
      } catch {}
      return prev
    })
  }, [])

  const handleApplyClick = useCallback(() => {
    setError(null)
    setParseError(null)

    let parsed: Record<string, unknown>
    try {
      parsed = yamlParse(content)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid YAML')
      return
    }

    if (!parsed?.apiVersion || !parsed?.kind) {
      setError('YAML must include apiVersion and kind')
      return
    }

    const metadata = parsed.metadata as Record<string, unknown> | undefined
    if (!metadata?.name) {
      setError('YAML must include metadata.name')
      return
    }

    if (!resolveResource(parsed, allResources)) {
      setError(`Unknown resource type: ${parsed.apiVersion}/${parsed.kind}`)
      return
    }

    setConfirmOpen(true)
  }, [content, allResources])

  const handleConfirmApply = useCallback(async () => {
    setConfirmOpen(false)

    let parsed: Record<string, unknown>
    try {
      parsed = yamlParse(content)
    } catch {
      return
    }

    const resource = resolveResource(parsed, allResources)
    if (!resource) return

    const metadata = parsed.metadata as Record<string, unknown> | undefined
    const ns = (metadata?.namespace as string | undefined) ?? (resource.namespaced ? namespace : undefined)

    setStatus('applying')
    try {
      await api.applyResource({
        group: resource.group,
        version: resource.version,
        name: resource.name,
        namespaced: resource.namespaced,
        namespace: ns,
        body: parsed,
      })
      setStatus('success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create resource'
      setError(message)
      setStatus('error')
    }
  }, [content, allResources, namespace])

  const handleGoToResource = useCallback(() => {
    try {
      const parsed = yamlParse(content)
      const resource = resolveResource(parsed, allResources)
      if (!resource) return
      const metadata = parsed.metadata as Record<string, unknown>
      const groupVersion = resource.group ? `${resource.group}/${resource.version}` : resource.version
      const ns = metadata.namespace as string | undefined
      const name = metadata.name as string

      let path = `${groupVersion}/${resource.name}`
      if (ns) path += `/${ns}`
      path += `/${name}`

      navigate({ to: '/resources/$', params: { _splat: path } })
    } catch {}
  }, [content, allResources, navigate])

  const fileName = useMemo(() => {
    if (activeSavedId) {
      const def = savedDefs.find((d) => d.id === activeSavedId)
      if (def) return def.name
    }
    if (selectedTemplate >= 0) return TEMPLATES[selectedTemplate].label
    return 'new-resource'
  }, [activeSavedId, savedDefs, selectedTemplate])

  return (
    <div className="-m-6 md:-m-8 h-[calc(100%+3rem)] md:h-[calc(100%+4rem)] flex flex-col overflow-hidden">
      <div className="p-4 pb-0">
        <Breadcrumb items={[{ label: 'Create Resource' }]} />
      </div>

      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-border-light dark:border-border-dark flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark bg-slate-50 dark:bg-surface-highlight">
            <span className="material-symbols-outlined text-slate-400 text-lg">draft</span>
            <span className="text-sm font-mono font-medium">{fileName}.yaml</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark bg-slate-50 dark:bg-surface-highlight">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Namespace</span>
            <select
              value={namespace}
              onChange={(e) => handleNamespaceChange(e.target.value)}
              className="w-36 px-2 py-0.5 text-sm rounded border border-border-light dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-slate-200 focus:outline-none focus:border-primary"
            >
              {namespaceNames.length === 0 && <option value={namespace}>{namespace}</option>}
              {namespaceNames.map((ns) => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!parseError && content.trim() && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span className="text-xs font-bold uppercase">Valid YAML</span>
            </div>
          )}
          {parseError && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg">
              <span className="material-symbols-outlined text-sm">error</span>
              <span className="text-xs font-bold uppercase">Invalid</span>
            </div>
          )}
          <Button
            onClick={handleApplyClick}
            disabled={status === 'applying' || !content.trim() || ctxLoading}
            className="bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined text-lg">play_arrow</span>
            {status === 'applying' ? 'Applying...' : 'Apply'}
          </Button>
        </div>
      </div>

      {status === 'success' && (
        <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400 text-[16px]">check_circle</span>
            <span className="text-xs text-emerald-400 font-medium">Resource created successfully</span>
          </div>
          <Button variant="ghost" size="xs" onClick={handleGoToResource} className="text-emerald-400 hover:text-emerald-300">
            View Resource
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Button>
        </div>
      )}

      {status === 'error' && error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-red-400 text-[16px]">error</span>
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      {/* Main: templates sidebar + editor */}
      <div className="flex-1 flex overflow-hidden">
        <div className="w-56 shrink-0 border-r border-border-light dark:border-border-dark p-4 overflow-y-auto">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-2">Templates</h3>
          <div className="flex flex-col gap-0.5">
            {TEMPLATES.map((t, idx) => (
              <button
                key={t.label}
                onClick={() => selectTemplate(idx)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group ${
                  selectedTemplate === idx
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-highlight'
                }`}
              >
                <span className={`material-symbols-outlined text-lg transition-colors ${
                  selectedTemplate === idx ? '' : 'group-hover:text-primary'
                }`}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {savedDefs.length > 0 && (
            <>
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-6 mb-3 px-2">
                Saved <span className="text-slate-600">({savedDefs.length})</span>
              </h3>
              <div className="flex flex-col gap-0.5">
                {savedDefs.map((def) => (
                  <div
                    key={def.id}
                    className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                      activeSavedId === def.id
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-highlight'
                    }`}
                    onClick={() => loadSaved(def)}
                  >
                    <span className={`material-symbols-outlined text-lg shrink-0 transition-colors ${
                      activeSavedId === def.id ? '' : 'group-hover:text-primary'
                    }`}>bookmark</span>
                    {renamingId === def.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => handleRenameSubmit(def.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSubmit(def.id)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 min-w-0 px-1 py-0 text-sm bg-transparent border-b border-primary outline-none text-slate-200"
                      />
                    ) : (
                      <span className="flex-1 min-w-0 truncate">{def.name}</span>
                    )}
                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setRenamingId(def.id)
                          setRenameValue(def.name)
                        }}
                        className="p-0.5 rounded hover:bg-surface-hover/50 text-slate-500 hover:text-slate-300"
                        title="Rename"
                      >
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(def.id)
                        }}
                        className="p-0.5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400"
                        title="Delete"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex-1 flex flex-col bg-background-dark overflow-hidden">
          <div className="flex-1 overflow-auto relative">
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              spellCheck={false}
              className="w-full h-full min-h-full p-4 font-mono text-sm leading-relaxed text-[#d4d4d4] bg-transparent resize-none outline-none whitespace-pre"
            />
            <div className="absolute right-4 top-4 flex flex-col gap-2">
              <button
                onClick={openSaveDialog}
                className="p-1.5 rounded-lg border border-border-dark bg-surface-highlight/60 hover:bg-surface-highlight hover:border-slate-500 transition-colors group/btn"
                title="Save"
              >
                <span className="material-symbols-outlined text-slate-400 group-hover/btn:text-slate-200 text-lg transition-colors">bookmark_add</span>
              </button>
              <button
                onClick={() => {
                  try {
                    const parsed = yamlParse(content)
                    setContent(yamlStringify(parsed, { indent: 2, lineWidth: 0 }))
                    setParseError(null)
                  } catch {}
                }}
                className="p-1.5 rounded-lg border border-border-dark bg-surface-highlight/60 hover:bg-surface-highlight hover:border-slate-500 transition-colors group/btn"
                title="Format"
              >
                <span className="material-symbols-outlined text-slate-400 group-hover/btn:text-slate-200 text-lg transition-colors">format_align_left</span>
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(content)}
                className="p-1.5 rounded-lg border border-border-dark bg-surface-highlight/60 hover:bg-surface-highlight hover:border-slate-500 transition-colors group/btn"
                title="Copy"
              >
                <span className="material-symbols-outlined text-slate-400 group-hover/btn:text-slate-200 text-lg transition-colors">content_copy</span>
              </button>
            </div>
          </div>
          <div className="h-8 bg-surface-highlight/40 border-t border-border-dark flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">code</span>
                YAML
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">tab</span>
                Spaces: 2
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">text_fields</span>
                UTF-8
              </span>
            </div>
          </div>
        </div>
      </div>

      {parseError && (
        <div className="px-4 py-2.5 border-t border-border-light dark:border-border-dark flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-amber-400 text-[16px]">warning</span>
          <span className="text-xs text-amber-400 font-mono">{parseError}</span>
        </div>
      )}

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{activeSavedId ? 'Update saved definition' : 'Save definition'}</DialogTitle>
            <DialogDescription>Give this YAML definition a name so you can reuse it later.</DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            placeholder="e.g. Production Deployment"
            className="w-full px-3 py-2 text-sm rounded-md border border-border-light dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-slate-200 focus:outline-none focus:border-primary"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!saveName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Apply resource</DialogTitle>
            <DialogDescription>This will apply the resource to your cluster.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-slate-50 dark:bg-surface-highlight/50">
              <span className="text-slate-500 dark:text-slate-400">Context</span>
              <span className="font-medium">{ctxData?.current ?? 'unknown'}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-slate-50 dark:bg-surface-highlight/50">
              <span className="text-slate-500 dark:text-slate-400">Namespace</span>
              <span className="font-medium">{namespace || 'default'}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmApply} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
