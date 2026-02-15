import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`node:fs`, () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

import { existsSync, readFileSync } from 'node:fs'
import { loadConfig } from './config'

describe(`loadConfig`, () => {
  let stderrOutput: string[]

  beforeEach(() => {
    vi.clearAllMocks()
    stderrOutput = []
    vi.spyOn(process.stderr, `write`).mockImplementation((chunk: any) => {
      stderrOutput.push(String(chunk))
      return true
    })
  })

  it(`should return undefined when file does not exist`, () => {
    vi.mocked(existsSync).mockReturnValue(false)
    expect(loadConfig()).toBeUndefined()
    expect(stderrOutput.length).toBe(0)
  })

  it(`should parse valid JSON config`, () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ org: `org1`, agent: `a1`, insecure: true })
    )

    const config = loadConfig()
    expect(config).toEqual({ org: `org1`, agent: `a1`, insecure: true })
    expect(stderrOutput.length).toBe(0)
  })

  it(`should return undefined and warn for corrupt JSON`, () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(`{not valid json`)

    expect(loadConfig()).toBeUndefined()
    expect(stderrOutput.join(``)).toContain(`Warning:`)
    expect(stderrOutput.join(``)).toContain(`Failed to load config`)
  })

  it(`should return undefined and warn when readFileSync throws`, () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error(`EACCES`)
    })

    expect(loadConfig()).toBeUndefined()
    expect(stderrOutput.join(``)).toContain(`Warning:`)
    expect(stderrOutput.join(``)).toContain(`EACCES`)
  })
})
