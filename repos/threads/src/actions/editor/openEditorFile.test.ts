import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLoadFileContent = vi.fn()
const mockSetOpenEditorFiles = vi.fn()
const mockSetActiveEditorFile = vi.fn()

vi.mock('@TTH/actions/editor/loadFileContent', () => ({
  loadFileContent: (...args: any[]) => mockLoadFileContent(...args),
}))

let openEditorFiles: string[] = []

vi.mock('@TTH/state/accessors', () => ({
  getOpenEditorFiles: () => openEditorFiles,
  setOpenEditorFiles: (...args: any[]) => mockSetOpenEditorFiles(...args),
  setActiveEditorFile: (...args: any[]) => mockSetActiveEditorFile(...args),
}))

import { openEditorFile } from './openEditorFile'

describe(`openEditorFile`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    openEditorFiles = []
    mockLoadFileContent.mockResolvedValue(undefined)
  })

  it(`appends the path to a new array when it is not already open`, () => {
    const original = [`/a.ts`, `/b.ts`]
    openEditorFiles = original

    openEditorFile(`/c.ts`)

    expect(mockSetOpenEditorFiles).toHaveBeenCalledWith([`/a.ts`, `/b.ts`, `/c.ts`])
    // the original reference must not be mutated in place.
    expect(original).toEqual([`/a.ts`, `/b.ts`])
    const committed = mockSetOpenEditorFiles.mock.calls[0][0]
    expect(committed).not.toBe(original)
  })

  it(`does not call setOpenEditorFiles when the path is already open`, () => {
    openEditorFiles = [`/a.ts`, `/c.ts`]

    openEditorFile(`/c.ts`)

    expect(mockSetOpenEditorFiles).not.toHaveBeenCalled()
  })

  it(`always sets the active editor file and triggers loadFileContent`, () => {
    openEditorFiles = [`/c.ts`]

    openEditorFile(`/c.ts`)

    expect(mockSetActiveEditorFile).toHaveBeenCalledWith(`/c.ts`)
    expect(mockLoadFileContent).toHaveBeenCalledWith(`/c.ts`)
  })

  it(`sets the active editor file and calls loadFileContent even for a newly opened path`, () => {
    openEditorFiles = []

    openEditorFile(`/new.ts`)

    expect(mockSetActiveEditorFile).toHaveBeenCalledWith(`/new.ts`)
    expect(mockLoadFileContent).toHaveBeenCalledWith(`/new.ts`)
  })

  it(`catches a loadFileContent rejection via console.warn instead of throwing`, async () => {
    const warnSpy = vi.spyOn(console, `warn`).mockImplementation(() => {})
    mockLoadFileContent.mockRejectedValue(new Error(`boom`))

    expect(() => openEditorFile(`/c.ts`)).not.toThrow()
    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        `[Editor] Failed to load /c.ts:`,
        expect.any(Error)
      )
    })

    warnSpy.mockRestore()
  })
})
