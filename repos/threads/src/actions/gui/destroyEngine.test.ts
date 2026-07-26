import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSetGuiAsts = vi.fn()
const mockSetGuiFeeds = vi.fn()
const mockSetGuiModes = vi.fn()
const mockSetGuiEngines = vi.fn()

let asts = new Map<string, any>()
let feeds = new Map<string, any>()
let modes = new Map<string, any>()
let engines = new Map<string, any>()

vi.mock(`@TTH/state/accessors`, () => ({
  getGuiAsts: () => asts,
  setGuiAsts: (...args: any[]) => mockSetGuiAsts(...args),
  getGuiFeeds: () => feeds,
  setGuiFeeds: (...args: any[]) => mockSetGuiFeeds(...args),
  getGuiModes: () => modes,
  setGuiModes: (...args: any[]) => mockSetGuiModes(...args),
  getGuiEngines: () => engines,
  setGuiEngines: (...args: any[]) => mockSetGuiEngines(...args),
}))

import { destroyEngine } from './destroyEngine'

const buildEngine = () => ({ destroy: vi.fn() })

describe(`destroyEngine`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    asts = new Map()
    feeds = new Map()
    modes = new Map()
    engines = new Map()
  })

  it(`calls engine.destroy() exactly once when an engine entry exists for the session`, () => {
    const engine = buildEngine()
    engines = new Map([[`sess_1`, engine]])

    destroyEngine(`sess_1`)

    expect(engine.destroy).toHaveBeenCalledTimes(1)
  })

  it(`does not throw and still cleans up state when there is no engine entry for the session`, () => {
    expect(() => destroyEngine(`sess_missing`)).not.toThrow()

    expect(mockSetGuiEngines).toHaveBeenCalledTimes(1)
    expect(mockSetGuiAsts).toHaveBeenCalledTimes(1)
    expect(mockSetGuiFeeds).toHaveBeenCalledTimes(1)
    expect(mockSetGuiModes).toHaveBeenCalledTimes(1)
  })

  it(`commits a NEW engines Map with the session removed and other entries preserved`, () => {
    const otherEngine = buildEngine()
    const targetEngine = buildEngine()
    engines = new Map([
      [`sess_1`, targetEngine],
      [`sess_other`, otherEngine],
    ])

    destroyEngine(`sess_1`)

    expect(mockSetGuiEngines).toHaveBeenCalledTimes(1)
    const committed = mockSetGuiEngines.mock.calls[0]![0] as Map<string, any>
    expect(committed).not.toBe(engines)
    expect(committed.has(`sess_1`)).toBe(false)
    expect(committed.get(`sess_other`)).toBe(otherEngine)
  })

  it(`commits a NEW asts Map with the session removed and other entries preserved (independent of engines)`, () => {
    asts = new Map([
      [`sess_1`, { type: `Document` }],
      [`sess_other`, { type: `other-doc` }],
    ])

    destroyEngine(`sess_1`)

    const committed = mockSetGuiAsts.mock.calls[0]![0] as Map<string, any>
    expect(committed).not.toBe(asts)
    expect(committed.has(`sess_1`)).toBe(false)
    expect(committed.get(`sess_other`)).toEqual({ type: `other-doc` })
  })

  it(`commits a NEW feeds Map with the session removed and other entries preserved (independent of engines/asts)`, () => {
    feeds = new Map([
      [`sess_1`, [{ id: `evt_1` }]],
      [`sess_other`, [{ id: `evt_2` }]],
    ])

    destroyEngine(`sess_1`)

    const committed = mockSetGuiFeeds.mock.calls[0]![0] as Map<string, any>
    expect(committed).not.toBe(feeds)
    expect(committed.has(`sess_1`)).toBe(false)
    expect(committed.get(`sess_other`)).toEqual([{ id: `evt_2` }])
  })

  it(`commits a NEW modes Map with the session removed and other entries preserved (independent of the other three maps)`, () => {
    modes = new Map([
      [`sess_1`, `tui`],
      [`sess_other`, `streaming`],
    ])

    destroyEngine(`sess_1`)

    const committed = mockSetGuiModes.mock.calls[0]![0] as Map<string, any>
    expect(committed).not.toBe(modes)
    expect(committed.has(`sess_1`)).toBe(false)
    expect(committed.get(`sess_other`)).toBe(`streaming`)
  })
})
