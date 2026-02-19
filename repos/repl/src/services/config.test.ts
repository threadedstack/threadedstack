import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConfigService } from './config'

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(),
  chmodSync: vi.fn(),
  statSync: vi.fn(),
}))

vi.mock('js-yaml', () => ({
  default: {
    load: vi.fn(),
    dump: vi.fn((obj: any) => JSON.stringify(obj)),
  },
  load: vi.fn(),
  dump: vi.fn((obj: any) => JSON.stringify(obj)),
}))

describe('ConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadGlobal returns empty config when file does not exist', async () => {
    const fs = await import('node:fs')
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const config = ConfigService.loadGlobal()
    expect(config).toEqual({})
  })

  it('loadGlobal parses YAML file', async () => {
    const fs = await import('node:fs')
    const yaml = await import('js-yaml')
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('org: org_1')
    vi.mocked(yaml.default.load).mockReturnValue({ org: 'org_1' })

    const config = ConfigService.loadGlobal()
    expect(config.org).toBe('org_1')
  })

  it('saveGlobal writes YAML with 0o600 permissions', async () => {
    const fs = await import('node:fs')

    ConfigService.saveGlobal({ org: 'org_1' })

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), {
      recursive: true,
      mode: 0o700,
    })
    expect(fs.writeFileSync).toHaveBeenCalled()
    expect(fs.chmodSync).toHaveBeenCalledWith(expect.any(String), 0o600)
  })

  it('loadProject returns empty config when .tdsk/config.yaml does not exist', async () => {
    const fs = await import('node:fs')
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const config = ConfigService.loadProject()
    expect(config).toEqual({})
  })

  it('merge layers config in correct order', () => {
    const global = { org: 'global_org', agent: 'global_agent' }
    const project = { agent: 'project_agent' }
    const merged = ConfigService.merge(global, project)
    expect(merged.org).toBe('global_org')
    expect(merged.agent).toBe('project_agent')
  })
})
