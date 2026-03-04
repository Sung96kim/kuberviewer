export type SavedDefinition = {
  id: string
  name: string
  yaml: string
  createdAt: string
}

const STORAGE_KEY = 'kuberviewer:saved-definitions'

export function loadSavedDefinitions(): SavedDefinition[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeDefs(defs: SavedDefinition[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defs))
}

export function saveDefinition(name: string, yaml: string): SavedDefinition {
  const defs = loadSavedDefinitions()
  const entry: SavedDefinition = { id: crypto.randomUUID(), name, yaml, createdAt: new Date().toISOString() }
  defs.push(entry)
  writeDefs(defs)
  return entry
}

export function renameDefinition(id: string, newName: string): void {
  const defs = loadSavedDefinitions()
  const def = defs.find((d) => d.id === id)
  if (def) {
    def.name = newName
    writeDefs(defs)
  }
}

export function updateDefinition(id: string, yaml: string): void {
  const defs = loadSavedDefinitions()
  const def = defs.find((d) => d.id === id)
  if (def) {
    def.yaml = yaml
    writeDefs(defs)
  }
}

export function removeDefinition(id: string): void {
  const defs = loadSavedDefinitions().filter((d) => d.id !== id)
  writeDefs(defs)
}
