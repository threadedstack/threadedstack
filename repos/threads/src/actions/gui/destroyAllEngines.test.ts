import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSetGuiAsts = vi.fn()
const mockSetGuiFeeds = vi.fn()
const mockSetGuiModes = vi.fn()
const mockSetGuiEngines = vi.fn()

let engines = new Map<string, any>()

vi.mock(`@TTH/state/accessors`, () => ({
  setGuiAsts: (...args: any[]) => mockSetGuiAsts(...args),
  setGuiFeeds: (...args: any[]) => mockSetGuiFeeds(...args),
  setGuiModes: (...args: any[]) => mockSetGuiModes(...args),
  getGuiEngines: () => engines,
  setGuiEngines: (...args: any[]) => mockSetGuiEngines(...args),
}))

import { destroyAllEngines } from './destroyAllEngines'

const buildEngine = (impl?: () => void) => ({ destroy: vi.fn(impl) })

describe(`destroyAllEngines`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    engines = new Map()
  })

  it(`calls destroy() on every engine in the map`, () => {
    const e1 = buildEngine()
    const e2 = buildEngine()
    engines = new Map([
      [`sess_1`, e1],
      [`sess_2`, e2],
    ])

    destroyAllEngines()

    expect(e1.destroy).toHaveBeenCalledTimes(1)
    expect(e2.destroy).toHaveBeenCalledTimes(1)
  })

  it(`swallows a thrown destroy() and still destroys the remaining engines afterward`, () => {
    const e1 = buildEngine()
    const e2 = buildEngine(() => {
      throw new Error(`already destroyed`)
    })
    const e3 = buildEngine()
    engines = new Map([
      [`sess_1`, e1],
      [`sess_2`, e2],
      [`sess_3`, e3],
    ])

    expect(() => destroyAllEngines()).not.toThrow()

    expect(e1.destroy).toHaveBeenCalledTimes(1)
    expect(e2.destroy).toHaveBeenCalledTimes(1)
    expect(e3.destroy).toHaveBeenCalledTimes(1)
  })

  it(`commits a genuinely empty new Map to all four gui state setters, even when engines had entries`, () => {
    engines = new Map([
      [`sess_1`, buildEngine()],
      [`sess_2`, buildEngine()],
    ])

    destroyAllEngines()

    expect(mockSetGuiEngines).toHaveBeenCalledTimes(1)
    expect(mockSetGuiAsts).toHaveBeenCalledTimes(1)
    expect(mockSetGuiFeeds).toHaveBeenCalledTimes(1)
    expect(mockSetGuiModes).toHaveBeenCalledTimes(1)

    const enginesArg = mockSetGuiEngines.mock.calls[0]![0] as Map<string, any>
    const astsArg = mockSetGuiAsts.mock.calls[0]![0] as Map<string, any>
    const feedsArg = mockSetGuiFeeds.mock.calls[0]![0] as Map<string, any>
    const modesArg = mockSetGuiModes.mock.calls[0]![0] as Map<string, any>

    expect(enginesArg.size).toBe(0)
    expect(astsArg.size).toBe(0)
    expect(feedsArg.size).toBe(0)
    expect(modesArg.size).toBe(0)
  })

  it(`with no engines to destroy, the loop body never runs but all four setters are still called with empty Maps`, () => {
    engines = new Map()

    destroyAllEngines()

    expect(mockSetGuiEngines).toHaveBeenCalledTimes(1)
    expect(mockSetGuiAsts).toHaveBeenCalledTimes(1)
    expect(mockSetGuiFeeds).toHaveBeenCalledTimes(1)
    expect(mockSetGuiModes).toHaveBeenCalledTimes(1)
    expect((mockSetGuiEngines.mock.calls[0]![0] as Map<string, any>).size).toBe(0)
  })
})
