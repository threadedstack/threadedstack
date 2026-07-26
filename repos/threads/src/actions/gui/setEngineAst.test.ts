import type { TDocument } from '@TTH/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSetGuiAsts = vi.fn()
const mockSetGuiModes = vi.fn()

let asts = new Map<string, TDocument>()
let modes = new Map<string, TDocument[`mode`]>()

vi.mock(`@TTH/state/accessors`, () => ({
  getGuiAsts: () => asts,
  setGuiAsts: (...args: any[]) => mockSetGuiAsts(...args),
  getGuiModes: () => modes,
  setGuiModes: (...args: any[]) => mockSetGuiModes(...args),
}))

import { setEngineAst } from './setEngineAst'

const buildDoc = (mode: TDocument[`mode`] = `interactive`): TDocument => ({
  type: `Document`,
  bounds: { top: 0, left: 0, bottom: 0, right: 0 },
  cursor: { x: 0, y: 0, visible: false },
  mode,
  children: [],
})

describe(`setEngineAst`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    asts = new Map()
    modes = new Map()
  })

  it(`REFERENCE-EQUALITY SHORT-CIRCUIT: returns immediately when the exact same doc reference is already stored`, () => {
    const doc = buildDoc()
    asts = new Map([[`session-1`, doc]])

    setEngineAst(`session-1`, doc)

    expect(mockSetGuiAsts).not.toHaveBeenCalled()
    expect(mockSetGuiModes).not.toHaveBeenCalled()
  })

  it(`does NOT short-circuit for a structurally-identical but different object reference`, () => {
    asts = new Map([[`session-1`, buildDoc()]])

    setEngineAst(`session-1`, buildDoc())

    expect(mockSetGuiAsts).toHaveBeenCalledTimes(1)
  })

  it(`proceeds normally when there is no prior AST for the session`, () => {
    const doc = buildDoc()

    setEngineAst(`session-1`, doc)

    expect(mockSetGuiAsts).toHaveBeenCalledTimes(1)
    const committed = mockSetGuiAsts.mock.calls[0][0] as Map<string, TDocument>
    expect(committed.get(`session-1`)).toBe(doc)
  })

  it(`commits a NEW asts Map preserving other session entries unchanged`, () => {
    const otherDoc = buildDoc()
    asts = new Map([[`session-other`, otherDoc]])
    const doc = buildDoc()

    setEngineAst(`session-1`, doc)

    const committed = mockSetGuiAsts.mock.calls[0][0] as Map<string, TDocument>
    expect(committed).not.toBe(asts)
    expect(committed.get(`session-other`)).toBe(otherDoc)
    expect(committed.get(`session-1`)).toBe(doc)
  })

  it(`updates modes via a NEW Map when the mode differs, preserving other entries`, () => {
    modes = new Map([[`session-other`, `tui`]])
    const doc = buildDoc(`streaming`)

    setEngineAst(`session-1`, doc)

    expect(mockSetGuiModes).toHaveBeenCalledTimes(1)
    const committed = mockSetGuiModes.mock.calls[0][0] as Map<string, TDocument[`mode`]>
    expect(committed).not.toBe(modes)
    expect(committed.get(`session-1`)).toBe(`streaming`)
    expect(committed.get(`session-other`)).toBe(`tui`)
  })

  it(`does NOT touch the modes Map when the mode is unchanged, even though the AST content changed`, () => {
    modes = new Map([[`session-1`, `interactive`]])
    const doc = buildDoc(`interactive`)

    setEngineAst(`session-1`, doc)

    expect(mockSetGuiAsts).toHaveBeenCalledTimes(1)
    expect(mockSetGuiModes).not.toHaveBeenCalled()
  })
})
