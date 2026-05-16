import type {
  TDocument,
  TFeedEvent,
  TTokenizeResult,
  TBrowserVTerminal,
} from '@TTH/types'

import { SessionEngine } from './sessionEngine'
import { parse } from '@TTH/services/gui/parser'
import { tokenize } from '@TTH/services/gui/tokenizer'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createBrowserTerminal } from '@TTH/services/gui/engine/wasmBridge'

// ---------------------------------------------------------------------------
// Fake terminal that satisfies TBrowserVTerminal
// ---------------------------------------------------------------------------
const fakeTerminal: TBrowserVTerminal = {
  cols: 80,
  rows: 24,
  write: vi.fn(),
  resize: vi.fn(),
  getDirtyRows: vi.fn(() => []),
  getViewport: vi.fn(() => new DataView(new ArrayBuffer(80 * 24 * 16))),
  getCursor: vi.fn(() => ({ x: 0, y: 0, visible: false })),
  isAlternateScreen: vi.fn(() => false),
  markClean: vi.fn(),
  free: vi.fn(),
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock(`@TTH/services/gui/engine/wasmBridge`, () => ({
  createBrowserTerminal: vi.fn(() => ({
    ...fakeTerminal,
    write: vi.fn(),
    resize: vi.fn(),
    getDirtyRows: vi.fn(() => []),
    getViewport: vi.fn(() => new DataView(new ArrayBuffer(80 * 24 * 16))),
    getCursor: vi.fn(() => ({ x: 0, y: 0, visible: false })),
    isAlternateScreen: vi.fn(() => false),
    markClean: vi.fn(),
    free: vi.fn(),
  })),
}))

const minimalTokenResult: TTokenizeResult = {
  tokens: [],
  cursor: { type: `CursorToken`, position: { x: 0, y: 0 }, visible: false },
  palette: { defaultFg: { r: 255, g: 255, b: 255 }, defaultBg: { r: 0, g: 0, b: 0 } },
  meta: [],
}

const minimalDoc: TDocument = {
  type: `Document`,
  bounds: { top: 0, left: 0, bottom: 23, right: 79 },
  cursor: { x: 0, y: 0, visible: false },
  mode: `interactive`,
  children: [],
}

vi.mock(`@TTH/services/gui/tokenizer`, () => ({
  tokenize: vi.fn(() => minimalTokenResult),
}))

vi.mock(`@TTH/services/gui/parser`, () => ({
  parse: vi.fn(() => minimalDoc),
}))

vi.mock(`@TTH/services/gui/visitors`, () => ({
  diffToFeedEvents: vi.fn(() => []),
}))

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe(`SessionEngine`, () => {
  let rafCb: (() => void) | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    rafCb = null

    // Stub requestAnimationFrame to capture the callback without auto-invoking
    vi.stubGlobal(
      `requestAnimationFrame`,
      vi.fn((cb: () => void) => {
        rafCb = cb
        return 1
      })
    )
    vi.stubGlobal(`cancelAnimationFrame`, vi.fn())

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // -----------------------------------------------------------------------
  // 1. create() returns a valid SessionEngine instance
  // -----------------------------------------------------------------------
  it(`create() returns a valid SessionEngine instance`, async () => {
    const onAST = vi.fn()
    const onFeedEvents = vi.fn()

    const engine = SessionEngine.create(`sess-1`, { onAST, onFeedEvents })

    expect(engine).toBeInstanceOf(SessionEngine)
    expect(engine.sessionId).toBe(`sess-1`)
    expect(createBrowserTerminal).toHaveBeenCalledWith(80, 24)

    engine.destroy()
  })

  // -----------------------------------------------------------------------
  // 2. write() calls terminal.write and sets dirty flag
  // -----------------------------------------------------------------------
  it(`write() calls terminal.write and schedules RAF`, async () => {
    const onAST = vi.fn()
    const onFeedEvents = vi.fn()
    const engine = SessionEngine.create(`sess-2`, { onAST, onFeedEvents })

    // Get the actual terminal instance the engine holds (from the mock)
    const mockCreateBT = vi.mocked(createBrowserTerminal)
    const terminal = mockCreateBT.mock.results[0].value

    engine.write(`hello`)

    expect(terminal.write).toHaveBeenCalledWith(`hello`)
    expect(requestAnimationFrame).toHaveBeenCalled()

    engine.destroy()
  })

  // -----------------------------------------------------------------------
  // 3. After write + RAF tick, onAST callback is invoked
  // -----------------------------------------------------------------------
  it(`onAST is invoked after write + RAF tick`, async () => {
    const onAST = vi.fn()
    const onFeedEvents = vi.fn()
    const engine = SessionEngine.create(`sess-3`, { onAST, onFeedEvents })

    engine.write(`data`)

    // Fire the captured RAF callback
    expect(rafCb).not.toBeNull()
    rafCb!()

    expect(tokenize).toHaveBeenCalled()
    expect(parse).toHaveBeenCalled()
    expect(onAST).toHaveBeenCalledWith(minimalDoc)

    engine.destroy()
  })

  // -----------------------------------------------------------------------
  // 4. resize() triggers immediate process (calls onAST)
  // -----------------------------------------------------------------------
  it(`resize() triggers immediate process`, async () => {
    const onAST = vi.fn()
    const onFeedEvents = vi.fn()
    const engine = SessionEngine.create(`sess-4`, { onAST, onFeedEvents })

    const mockCreateBT = vi.mocked(createBrowserTerminal)
    const terminal = mockCreateBT.mock.results[0].value

    engine.resize(120, 40)

    expect(terminal.resize).toHaveBeenCalledWith(120, 40)
    // resize() calls process() synchronously, so onAST should fire immediately
    expect(onAST).toHaveBeenCalledWith(minimalDoc)

    engine.destroy()
  })

  // -----------------------------------------------------------------------
  // 5. destroy() clears timers and calls terminal.free
  // -----------------------------------------------------------------------
  it(`destroy() clears timers and calls terminal.free`, async () => {
    const onAST = vi.fn()
    const onFeedEvents = vi.fn()
    const engine = SessionEngine.create(`sess-5`, { onAST, onFeedEvents })

    const mockCreateBT = vi.mocked(createBrowserTerminal)
    const terminal = mockCreateBT.mock.results[0].value

    engine.destroy()

    expect(terminal.free).toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // 6. After destroy, write() is a no-op
  // -----------------------------------------------------------------------
  it(`after destroy, write() is a no-op`, async () => {
    const onAST = vi.fn()
    const onFeedEvents = vi.fn()
    const engine = SessionEngine.create(`sess-6`, { onAST, onFeedEvents })

    const mockCreateBT = vi.mocked(createBrowserTerminal)
    const terminal = mockCreateBT.mock.results[0].value

    engine.destroy()
    vi.clearAllMocks()

    engine.write(`should be ignored`)

    expect(terminal.write).not.toHaveBeenCalled()
    expect(requestAnimationFrame).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // 7. Consecutive errors: 3rd failure emits error output event
  // -----------------------------------------------------------------------
  it(`emits error output event on 3rd consecutive failure`, async () => {
    const onAST = vi.fn()
    const onFeedEvents = vi.fn()
    const engine = SessionEngine.create(`sess-7`, { onAST, onFeedEvents })

    const mockTokenize = vi.mocked(tokenize)
    mockTokenize.mockImplementation(() => {
      throw new Error(`tokenize failed`)
    })

    // Suppress console.error noise from the engine
    const consoleSpy = vi.spyOn(console, `error`).mockImplementation(() => {})

    // Trigger 3 process cycles via resize (each calls process() synchronously)
    engine.resize(80, 24)
    engine.resize(80, 24)
    engine.resize(80, 24)

    // onFeedEvents should have been called on the 3rd failure
    expect(onFeedEvents).toHaveBeenCalledTimes(1)
    const events: TFeedEvent[] = onFeedEvents.mock.calls[0][0]
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe(`output`)
    expect(events[0]).toHaveProperty(`summary`)
    expect((events[0] as Extract<TFeedEvent, { kind: `output` }>).summary).toContain(
      `3 consecutive failures`
    )

    consoleSpy.mockRestore()
    engine.destroy()
  })

  // -----------------------------------------------------------------------
  // 8. Error counter resets after successful process
  // -----------------------------------------------------------------------
  it(`error counter resets after successful process`, async () => {
    const onAST = vi.fn()
    const onFeedEvents = vi.fn()
    const engine = SessionEngine.create(`sess-8`, { onAST, onFeedEvents })

    const mockTokenize = vi.mocked(tokenize)
    const consoleSpy = vi.spyOn(console, `error`).mockImplementation(() => {})

    // Fail twice
    mockTokenize.mockImplementation(() => {
      throw new Error(`fail`)
    })
    engine.resize(80, 24)
    engine.resize(80, 24)

    // Succeed once — resets the counter
    mockTokenize.mockImplementation(() => minimalTokenResult)
    engine.resize(80, 24)

    expect(onAST).toHaveBeenCalled()

    // Fail twice more — should NOT trigger error event (counter was reset)
    onFeedEvents.mockClear()
    mockTokenize.mockImplementation(() => {
      throw new Error(`fail again`)
    })
    engine.resize(80, 24)
    engine.resize(80, 24)

    // Only 2 failures, not 3, so onFeedEvents should not fire with error
    expect(onFeedEvents).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
    engine.destroy()
  })
})
