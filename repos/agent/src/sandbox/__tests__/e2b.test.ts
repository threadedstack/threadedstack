import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TSandboxConfig } from '@tdsk/domain'

const {
  mockRun,
  mockRead,
  mockWrite,
  mockList,
  mockRemove,
  mockMakeDir,
  mockKill,
  mockCreate,
} = vi.hoisted(() => ({
  mockRun: vi.fn(),
  mockRead: vi.fn(),
  mockWrite: vi.fn(),
  mockList: vi.fn(),
  mockRemove: vi.fn(),
  mockMakeDir: vi.fn(),
  mockKill: vi.fn(),
  mockCreate: vi.fn(),
}))

vi.mock(`e2b`, () => ({
  Sandbox: {
    create: mockCreate,
  },
}))

import { E2bSandbox, E2bSandboxProvider } from '@TAG/sandbox/e2b'

const createMockE2bSandbox = () => ({
  commands: { run: mockRun },
  files: {
    read: mockRead,
    write: mockWrite,
    list: mockList,
    remove: mockRemove,
    makeDir: mockMakeDir,
  },
  kill: mockKill,
})

describe(`E2bSandbox`, () => {
  let sandbox: E2bSandbox
  let mockE2b: ReturnType<typeof createMockE2bSandbox>

  beforeEach(() => {
    vi.clearAllMocks()
    mockE2b = createMockE2bSandbox()
    sandbox = new E2bSandbox(mockE2b as any)
  })

  describe(`exec`, () => {
    it(`should run a command without args`, async () => {
      mockRun.mockResolvedValue({
        exitCode: 0,
        stdout: `hello world`,
        stderr: ``,
      })

      const result = await sandbox.exec(`echo hello world`)

      expect(mockRun).toHaveBeenCalledWith(`echo hello world`)
      expect(result).toEqual({
        success: true,
        output: `hello world`,
        error: undefined,
        exitCode: 0,
      })
    })

    it(`should join args with spaces when provided`, async () => {
      mockRun.mockResolvedValue({
        exitCode: 0,
        stdout: `file.txt`,
        stderr: ``,
      })

      const result = await sandbox.exec(`ls`, [`-la`, `/tmp`])

      expect(mockRun).toHaveBeenCalledWith(`ls -la /tmp`)
      expect(result).toEqual({
        success: true,
        output: `file.txt`,
        error: undefined,
        exitCode: 0,
      })
    })

    it(`should map non-zero exit code to success false`, async () => {
      mockRun.mockResolvedValue({
        exitCode: 1,
        stdout: ``,
        stderr: `command not found`,
      })

      const result = await sandbox.exec(`badcmd`)

      expect(result).toEqual({
        success: false,
        output: ``,
        error: `command not found`,
        exitCode: 1,
      })
    })

    it(`should set error to undefined when stderr is empty`, async () => {
      mockRun.mockResolvedValue({
        exitCode: 127,
        stdout: ``,
        stderr: ``,
      })

      const result = await sandbox.exec(`missing`)

      expect(result.error).toBeUndefined()
      expect(result.exitCode).toBe(127)
    })

    it(`should default args to empty array`, async () => {
      mockRun.mockResolvedValue({
        exitCode: 0,
        stdout: `ok`,
        stderr: ``,
      })

      await sandbox.exec(`pwd`)

      expect(mockRun).toHaveBeenCalledWith(`pwd`)
    })
  })

  describe(`readFile`, () => {
    it(`should read file contents from sandbox`, async () => {
      mockRead.mockResolvedValue(`file contents here`)

      const content = await sandbox.readFile(`/tmp/test.txt`)

      expect(mockRead).toHaveBeenCalledWith(`/tmp/test.txt`)
      expect(content).toBe(`file contents here`)
    })
  })

  describe(`writeFile`, () => {
    it(`should write content to a file in the sandbox`, async () => {
      mockWrite.mockResolvedValue(undefined)

      await sandbox.writeFile(`/tmp/out.txt`, `data`)

      expect(mockWrite).toHaveBeenCalledWith(`/tmp/out.txt`, `data`)
    })
  })

  describe(`listDir`, () => {
    it(`should return file names and prefixed directory names`, async () => {
      mockList.mockResolvedValue([
        { name: `src`, type: `dir` },
        { name: `index.ts`, type: `file` },
        { name: `node_modules`, type: `dir` },
        { name: `package.json`, type: `file` },
      ])

      const entries = await sandbox.listDir(`/project`)

      expect(mockList).toHaveBeenCalledWith(`/project`)
      expect(entries).toEqual([
        `[DIR] src`,
        `index.ts`,
        `[DIR] node_modules`,
        `package.json`,
      ])
    })

    it(`should return empty array for empty directory`, async () => {
      mockList.mockResolvedValue([])

      const entries = await sandbox.listDir(`/empty`)

      expect(entries).toEqual([])
    })
  })

  describe(`deleteFile`, () => {
    it(`should remove a file from the sandbox`, async () => {
      mockRemove.mockResolvedValue(undefined)

      await sandbox.deleteFile(`/tmp/old.txt`)

      expect(mockRemove).toHaveBeenCalledWith(`/tmp/old.txt`)
    })
  })

  describe(`mkdir`, () => {
    it(`should create a directory in the sandbox`, async () => {
      mockMakeDir.mockResolvedValue(undefined)

      await sandbox.mkdir(`/tmp/newdir`)

      expect(mockMakeDir).toHaveBeenCalledWith(`/tmp/newdir`)
    })
  })

  describe(`fileExists`, () => {
    it(`should return true when file can be read`, async () => {
      mockRead.mockResolvedValue(`some content`)

      const exists = await sandbox.fileExists(`/tmp/exists.txt`)

      expect(mockRead).toHaveBeenCalledWith(`/tmp/exists.txt`)
      expect(exists).toBe(true)
    })

    it(`should return false when read throws an error`, async () => {
      mockRead.mockRejectedValue(new Error(`File not found`))

      const exists = await sandbox.fileExists(`/tmp/missing.txt`)

      expect(mockRead).toHaveBeenCalledWith(`/tmp/missing.txt`)
      expect(exists).toBe(false)
    })
  })

  describe(`close`, () => {
    it(`should kill the underlying sandbox`, async () => {
      mockKill.mockResolvedValue(undefined)

      await sandbox.close()

      expect(mockKill).toHaveBeenCalledOnce()
    })
  })
})

describe(`E2bSandboxProvider`, () => {
  let provider: E2bSandboxProvider

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new E2bSandboxProvider()
  })

  it(`should have type set to 'e2b'`, () => {
    expect(provider.type).toBe(`e2b`)
  })

  describe(`create`, () => {
    it(`should create an E2bSandbox with the given config`, async () => {
      const mockE2b = createMockE2bSandbox()
      mockCreate.mockResolvedValue(mockE2b)

      const config: TSandboxConfig = {
        provider: `e2b`,
        template: `node-20`,
        apiKey: `e2b_test_key_123`,
        timeout: 30000,
        envVars: { NODE_ENV: `test`, DEBUG: `true` },
      }

      const sandbox = await provider.create(config)

      expect(mockCreate).toHaveBeenCalledWith(`node-20`, {
        apiKey: `e2b_test_key_123`,
        timeoutMs: 30000,
        envs: { NODE_ENV: `test`, DEBUG: `true` },
      })
      expect(sandbox).toBeInstanceOf(E2bSandbox)
    })

    it(`should pass undefined for optional config fields`, async () => {
      const mockE2b = createMockE2bSandbox()
      mockCreate.mockResolvedValue(mockE2b)

      const config: TSandboxConfig = {
        provider: `e2b`,
      }

      const sandbox = await provider.create(config)

      expect(mockCreate).toHaveBeenCalledWith(undefined, {
        apiKey: undefined,
        timeoutMs: undefined,
        envs: undefined,
      })
      expect(sandbox).toBeInstanceOf(E2bSandbox)
    })

    it(`should return a functional sandbox that delegates to the e2b instance`, async () => {
      const mockE2b = createMockE2bSandbox()
      mockCreate.mockResolvedValue(mockE2b)
      mockRun.mockResolvedValue({ exitCode: 0, stdout: `ok`, stderr: `` })

      const config: TSandboxConfig = { provider: `e2b`, template: `base` }
      const sandbox = await provider.create(config)
      const result = await sandbox.exec(`echo ok`)

      expect(result.success).toBe(true)
      expect(result.output).toBe(`ok`)
    })
  })
})
