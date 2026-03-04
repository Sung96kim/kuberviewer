export type ShellState = {
  shellOpen: boolean
  execStarted: boolean
  textareaFocused: boolean
}

export type ShellAction =
  | { type: 'open' }
  | { type: 'startExec' }
  | { type: 'blur' }
  | { type: 'close' }

export function resolveShellToggle(state: ShellState): ShellAction[] {
  if (!state.shellOpen) {
    const actions: ShellAction[] = []
    if (!state.execStarted) actions.push({ type: 'startExec' })
    actions.push({ type: 'open' })
    return actions
  }

  if (state.textareaFocused) {
    return [{ type: 'blur' }]
  }

  return [{ type: 'close' }]
}
