import { vi, describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockSetEngineAst = vi.fn()
const mockDestroyEngine = vi.fn()
const mockRegisterEngine = vi.fn()
const mockAppendFeedEvents = vi.fn()
const mockSessionEngineCreate = vi.fn()

let enginesMap = new Map<string, any>()
const mockUseGuiEngines = vi.fn(() => [enginesMap] as [Map<string, any>])

vi.mock(`@TTH/state/selectors`, () => ({
  useGuiEngines: () => mockUseGuiEngines(),
}))

vi.mock(`@TTH/actions/gui/setEngineAst`, () => ({
  setEngineAst: (...args: any[]) => mockSetEngineAst(...args),
}))

vi.mock(`@TTH/actions/gui/destroyEngine`, () => ({
  destroyEngine: (...args: any[]) => mockDestroyEngine(...args),
}))

vi.mock(`@TTH/actions/gui/registerEngine`, () => ({
  registerEngine: (...args: any[]) => mockRegisterEngine(...args),
}))

vi.mock(`@TTH/actions/gui/appendFeedEvents`, () => ({
  appendFeedEvents: (...args: any[]) => mockAppendFeedEvents(...args),
}))

vi.mock(`@TTH/services/gui/engine/sessionEngine`, () => ({
  SessionEngine: {
    create: (...args: any[]) => mockSessionEngineCreate(...args),
  },
}))

import { useSessionEngine } from './useSessionEngine'

describe(`useSessionEngine`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enginesMap = new Map()
    mockSessionEngineCreate.mockImplementation(() => ({ id: `engine-fixture` }))
  })

  it(`no-ops and returns null when sessionId is null`, () => {
    const { result } = renderHook(() => useSessionEngine(null))

    expect(mockSessionEngineCreate).not.toHaveBeenCalled()
    expect(mockRegisterEngine).not.toHaveBeenCalled()
    expect(result.current).toBeNull()
  })

  it(`creates and registers a new engine when the sessionId has no existing entry`, () => {
    renderHook(() => useSessionEngine(`session-1`))

    expect(mockSessionEngineCreate).toHaveBeenCalledTimes(1)
    expect(mockSessionEngineCreate).toHaveBeenCalledWith(
      `session-1`,
      expect.objectContaining({
        onAST: expect.any(Function),
        onFeedEvents: expect.any(Function),
      })
    )
    expect(mockRegisterEngine).toHaveBeenCalledWith(`session-1`, { id: `engine-fixture` })
  })

  it(`DUPLICATE-CREATION GUARD: no-ops when engines already has an entry for the sessionId`, () => {
    enginesMap = new Map([[`session-1`, { id: `already-there` }]])

    renderHook(() => useSessionEngine(`session-1`))

    expect(mockSessionEngineCreate).not.toHaveBeenCalled()
    expect(mockRegisterEngine).not.toHaveBeenCalled()
  })

  it(`calls destroyEngine on cleanup (unmount)`, () => {
    const { unmount } = renderHook(() => useSessionEngine(`session-1`))

    unmount()

    expect(mockDestroyEngine).toHaveBeenCalledWith(`session-1`)
  })

  it(`calls destroyEngine for the OLD sessionId when sessionId changes`, () => {
    const { rerender } = renderHook(({ sessionId }) => useSessionEngine(sessionId), {
      initialProps: { sessionId: `session-1` },
    })

    rerender({ sessionId: `session-2` })

    expect(mockDestroyEngine).toHaveBeenCalledWith(`session-1`)
    expect(mockSessionEngineCreate).toHaveBeenCalledWith(`session-2`, expect.anything())
  })

  it(`the onAST callback passed to SessionEngine.create invokes setEngineAst(sessionId, doc)`, () => {
    renderHook(() => useSessionEngine(`session-1`))

    const options = mockSessionEngineCreate.mock.calls[0]![1]
    const doc = { type: `root`, children: [] }
    options.onAST(doc)

    expect(mockSetEngineAst).toHaveBeenCalledWith(`session-1`, doc)
  })

  it(`the onFeedEvents callback passed to SessionEngine.create invokes appendFeedEvents(sessionId, events)`, () => {
    renderHook(() => useSessionEngine(`session-1`))

    const options = mockSessionEngineCreate.mock.calls[0]![1]
    const events = [{ type: `text` }]
    options.onFeedEvents(events)

    expect(mockAppendFeedEvents).toHaveBeenCalledWith(`session-1`, events)
  })

  it(`returns engines.get(sessionId) when present, else null`, () => {
    enginesMap = new Map([[`session-1`, { id: `existing-engine` }]])

    const { result } = renderHook(() => useSessionEngine(`session-1`))

    expect(result.current).toEqual({ id: `existing-engine` })
  })

  it(`with sessionId null, looks up engines.get('') -- returns that entry if present (proves the '?? ''' fallback lookup, not just a bare null)`, () => {
    enginesMap = new Map([[``, { id: `weird-empty-key-engine` }]])

    const { result } = renderHook(() => useSessionEngine(null))

    expect(result.current).toEqual({ id: `weird-empty-key-engine` })
  })

  it(`THE SUBTLE BRANCH: does not recreate the engine when the engines map atom changes but sessionId stays the same`, () => {
    const { rerender } = renderHook(({ sessionId }) => useSessionEngine(sessionId), {
      initialProps: { sessionId: `session-1` },
    })
    expect(mockSessionEngineCreate).toHaveBeenCalledTimes(1)

    // Simulate the engines atom updating to a NEW Map reference (e.g. some
    // other session registered) while sessionId itself is unchanged -- the
    // effect must NOT rerun, since `engines` is intentionally excluded from
    // the dependency array.
    enginesMap = new Map([
      [`session-1`, { id: `engine-fixture` }],
      [`other`, {}],
    ])
    rerender({ sessionId: `session-1` })

    expect(mockSessionEngineCreate).toHaveBeenCalledTimes(1)
    expect(mockDestroyEngine).not.toHaveBeenCalled()
  })
})
