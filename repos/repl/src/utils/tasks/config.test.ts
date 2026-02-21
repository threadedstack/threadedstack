import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLoadGlobal = vi.fn()
const mockLoadProject = vi.fn()
const mockMerge = vi.fn()
const mockSaveGlobal = vi.fn()

vi.mock(`@TRL/services/config`, () => ({
  ConfigService: {
    loadGlobal: (...args: any[]) => mockLoadGlobal(...args),
    loadProject: (...args: any[]) => mockLoadProject(...args),
    merge: (...args: any[]) => mockMerge(...args),
    saveGlobal: (...args: any[]) => mockSaveGlobal(...args),
  },
}))

import { loadConfig } from './config'

describe(`loadConfig`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should return merged config from global and project`, () => {
    const globalConfig = { org: `org1`, agent: `a1` }
    const projectConfig = { agent: `proj-agent` }
    const merged = { org: `org1`, agent: `proj-agent` }

    mockLoadGlobal.mockReturnValue(globalConfig)
    mockLoadProject.mockReturnValue(projectConfig)
    mockMerge.mockReturnValue(merged)

    const config = loadConfig()

    expect(config).toEqual(merged)
    expect(mockLoadGlobal).toHaveBeenCalledTimes(1)
    expect(mockLoadProject).toHaveBeenCalledTimes(1)
    expect(mockMerge).toHaveBeenCalledWith(globalConfig, projectConfig)
  })

  it(`should return undefined when ConfigService throws`, () => {
    mockLoadGlobal.mockImplementation(() => {
      throw new Error(`EACCES`)
    })

    expect(loadConfig()).toBeUndefined()
  })

  it(`should return merged result with empty configs`, () => {
    mockLoadGlobal.mockReturnValue({})
    mockLoadProject.mockReturnValue({})
    mockMerge.mockReturnValue({})

    const config = loadConfig()
    expect(config).toEqual({})
  })
})
