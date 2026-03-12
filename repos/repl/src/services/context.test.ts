import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ContextLoader } from './context'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}))

describe('ContextLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('autoDetect finds AGENTS.md in cwd', async () => {
    const fs = await import('node:fs')
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      return String(p).endsWith('AGENTS.md')
    })
    vi.mocked(fs.readFileSync).mockReturnValue('agent instructions')
    vi.mocked(fs.statSync).mockReturnValue({ size: 100, isFile: () => true } as any)

    const files = ContextLoader.autoDetect('/test/project')
    expect(files).toHaveLength(1)
    expect(files[0].name).toBe('AGENTS.md')
    expect(files[0].source).toBe('auto')
  })

  it('autoDetect scans .tdsk/context/ directory', async () => {
    const fs = await import('node:fs')
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      return String(p).includes('.tdsk/context')
    })
    vi.mocked(fs.readdirSync).mockReturnValue(['arch.md', 'api.md'] as any)
    vi.mocked(fs.readFileSync).mockReturnValue('content')
    vi.mocked(fs.statSync).mockReturnValue({ size: 50, isFile: () => true } as any)

    const files = ContextLoader.autoDetect('/test/project')
    expect(files.length).toBeGreaterThanOrEqual(2)
  })

  it('loadFile reads and returns context file', async () => {
    const fs = await import('node:fs')
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('file content')
    vi.mocked(fs.statSync).mockReturnValue({ size: 200, isFile: () => true } as any)

    const file = ContextLoader.loadFile('/test/file.md')
    expect(file).not.toBeNull()
    expect(file!.content).toBe('file content')
    expect(file!.source).toBe('manual')
  })

  it('loadFile returns null for nonexistent files', async () => {
    const fs = await import('node:fs')
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const file = ContextLoader.loadFile('/test/missing.md')
    expect(file).toBeNull()
  })

  it('autoDetect returns empty array when nothing found', async () => {
    const fs = await import('node:fs')
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const files = ContextLoader.autoDetect('/empty/dir')
    expect(files).toEqual([])
  })

  it('loadFile returns null for directories', async () => {
    const fs = await import('node:fs')
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.statSync).mockReturnValue({ size: 0, isFile: () => false } as any)

    const file = ContextLoader.loadFile('/test/dir')
    expect(file).toBeNull()
  })
})
