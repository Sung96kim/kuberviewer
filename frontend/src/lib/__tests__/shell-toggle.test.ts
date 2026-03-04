import { describe, it, expect } from 'vitest'
import { resolveShellToggle } from '../shell-toggle'

describe('resolveShellToggle', () => {
  it('opens shell and starts exec when closed and not started', () => {
    const actions = resolveShellToggle({
      shellOpen: false,
      execStarted: false,
      textareaFocused: false,
    })
    expect(actions).toEqual([{ type: 'startExec' }, { type: 'open' }])
  })

  it('opens shell without starting exec when already started', () => {
    const actions = resolveShellToggle({
      shellOpen: false,
      execStarted: true,
      textareaFocused: false,
    })
    expect(actions).toEqual([{ type: 'open' }])
  })

  it('blurs textarea when shell is open and textarea is focused', () => {
    const actions = resolveShellToggle({
      shellOpen: true,
      execStarted: true,
      textareaFocused: true,
    })
    expect(actions).toEqual([{ type: 'blur' }])
  })

  it('closes shell when open and textarea is not focused', () => {
    const actions = resolveShellToggle({
      shellOpen: true,
      execStarted: true,
      textareaFocused: false,
    })
    expect(actions).toEqual([{ type: 'close' }])
  })

  it('full cycle: open -> blur -> close', () => {
    const step1 = resolveShellToggle({
      shellOpen: false,
      execStarted: false,
      textareaFocused: false,
    })
    expect(step1).toEqual([{ type: 'startExec' }, { type: 'open' }])

    const step2 = resolveShellToggle({
      shellOpen: true,
      execStarted: true,
      textareaFocused: true,
    })
    expect(step2).toEqual([{ type: 'blur' }])

    const step3 = resolveShellToggle({
      shellOpen: true,
      execStarted: true,
      textareaFocused: false,
    })
    expect(step3).toEqual([{ type: 'close' }])
  })
})
