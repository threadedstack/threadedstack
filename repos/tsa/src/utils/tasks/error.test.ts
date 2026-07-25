import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock(`@TSA/theme`, () => ({
  themed: (_color: string, text: string) => text,
}))

import { taskError } from './error'

describe(`taskError`, () => {
  let writeSpy: ReturnType<typeof vi.spyOn>
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, `write`).mockImplementation(() => true)
    exitSpy = vi.spyOn(process, `exit`).mockImplementation((() => undefined) as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const written = () => writeSpy.mock.calls.map((c) => String(c[0])).join(``)

  it(`normalizes a string error to its message and does not include a stack trace, even when stack=true`, () => {
    taskError(`something broke`, true)

    expect(written()).toContain(`something broke`)
    expect(written()).not.toContain(`.test.ts`)
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it(`uses the Error's stack when stack defaults to true and a stack is present`, () => {
    const err = new Error(`boom`)
    err.stack = `boom\n    at fakeFrame (file.ts:1:1)`

    taskError(err)

    expect(written()).toContain(err.stack)
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it(`uses the Error's message instead of its stack when stack is explicitly false`, () => {
    const err = new Error(`boom`)
    err.stack = `boom\n    at fakeFrame (file.ts:1:1)`

    taskError(err, false)

    expect(written()).toContain(`boom`)
    expect(written()).not.toContain(`at fakeFrame`)
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it(`falls back to the Error's message when stack is truthy but err.stack is falsy`, () => {
    const err = new Error(`boom`)
    err.stack = undefined

    taskError(err, true)

    expect(written()).toContain(`boom`)
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it(`calls process.exit exactly once with 1 in every case`, () => {
    taskError(`str case`)
    expect(exitSpy).toHaveBeenCalledTimes(1)
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
