import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveContext } from './saveContext'

const mockSaveGlobal = vi.fn()
vi.mock(`@TSA/services/config`, () => ({
  ConfigService: {
    saveGlobal: (...args: any[]) => mockSaveGlobal(...args),
  },
}))

describe(`saveContext`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(process.stderr, `write`).mockImplementation(() => true)
  })

  it(`saves org, project, and sandboxId when org changes`, () => {
    saveContext(
      { org: `old-org`, project: `old-proj`, sandboxId: `old-sb` },
      `new-org`,
      `new-proj`,
      `new-sb`
    )
    expect(mockSaveGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        org: `new-org`,
        project: `new-proj`,
        sandboxId: `new-sb`,
      })
    )
  })

  it(`clears sandboxId when org changes and no sandbox provided`, () => {
    saveContext(
      { org: `old-org`, project: `old-proj`, sandboxId: `old-sb` },
      `new-org`,
      `new-proj`
    )
    const saved = mockSaveGlobal.mock.calls[0][0]
    expect(saved.org).toBe(`new-org`)
    expect(saved.project).toBe(`new-proj`)
    expect(saved.sandboxId).toBeUndefined()
  })

  it(`saves project and sandboxId when project changes but org is same`, () => {
    saveContext(
      { org: `org1`, project: `old-proj`, sandboxId: `old-sb` },
      `org1`,
      `new-proj`,
      `new-sb`
    )
    const saved = mockSaveGlobal.mock.calls[0][0]
    expect(saved.org).toBe(`org1`)
    expect(saved.project).toBe(`new-proj`)
    expect(saved.sandboxId).toBe(`new-sb`)
  })

  it(`clears sandboxId when project changes and no sandbox provided`, () => {
    saveContext(
      { org: `org1`, project: `old-proj`, sandboxId: `old-sb` },
      `org1`,
      `new-proj`
    )
    const saved = mockSaveGlobal.mock.calls[0][0]
    expect(saved.project).toBe(`new-proj`)
    expect(saved.sandboxId).toBeUndefined()
  })

  it(`saves only sandboxId when org and project are unchanged`, () => {
    saveContext(
      { org: `org1`, project: `proj1`, sandboxId: `old-sb` },
      `org1`,
      `proj1`,
      `new-sb`
    )
    const saved = mockSaveGlobal.mock.calls[0][0]
    expect(saved.sandboxId).toBe(`new-sb`)
    expect(saved.org).toBe(`org1`)
    expect(saved.project).toBe(`proj1`)
  })

  it(`does not call saveGlobal when nothing changed`, () => {
    saveContext(
      { org: `org1`, project: `proj1`, sandboxId: `sb1` },
      `org1`,
      `proj1`,
      `sb1`
    )
    expect(mockSaveGlobal).not.toHaveBeenCalled()
  })

  it(`does not call saveGlobal when org and project match and no sandboxId provided`, () => {
    saveContext({ org: `org1`, project: `proj1` }, `org1`, `proj1`)
    expect(mockSaveGlobal).not.toHaveBeenCalled()
  })

  it(`writes warning to stderr when saveGlobal throws`, () => {
    mockSaveGlobal.mockImplementation(() => {
      throw new Error(`EACCES: permission denied`)
    })
    saveContext({ org: `org1`, project: `proj1` }, `new-org`, `new-proj`)
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining(`EACCES`))
  })

  it(`handles non-Error throws in saveGlobal`, () => {
    mockSaveGlobal.mockImplementation(() => {
      throw `string error`
    })
    saveContext({ org: `org1`, project: `proj1` }, `new-org`, `new-proj`)
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining(`string error`)
    )
  })
})
