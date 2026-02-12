import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocalSandbox, LocalSandboxProvider } from './local'

/**
 * Tests for the local sandbox (ISandbox implementation via just-bash)
 * All FS methods delegate to the IFileSystem instance
 * Shell commands go through Bash virtual shell
 */
describe(`LocalSandbox`, () => {
  let mockBash: any
  let mockFs: any
  let mockIsolateRunner: any
  let sandbox: LocalSandbox

  beforeEach(() => {
    mockBash = {
      exec: vi.fn(),
    }

    mockFs = {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      rm: vi.fn(),
      mkdir: vi.fn(),
    }

    mockIsolateRunner = {
      dispose: vi.fn(),
    }

    sandbox = new LocalSandbox(mockBash, mockFs, mockIsolateRunner)
  })

  describe(`sandbox.exec (just-bash virtual shell)`, () => {
    it(`should run a command and return success result`, async () => {
      mockBash.exec.mockResolvedValue({
        exitCode: 0,
        stdout: `hello world`,
        stderr: ``,
      })

      const result = await sandbox.exec(`echo`, [`hello`, `world`])

      expect(mockBash.exec).toHaveBeenCalledWith(`echo hello world`, {
        cwd: `/workspace`,
      })
      expect(result).toEqual({
        success: true,
        output: `hello world`,
        error: undefined,
        exitCode: 0,
      })
    })

    it(`should return failure result for non-zero exit code`, async () => {
      mockBash.exec.mockResolvedValue({
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

    it(`should handle command with no args`, async () => {
      mockBash.exec.mockResolvedValue({
        exitCode: 0,
        stdout: `/workspace`,
        stderr: ``,
      })

      await sandbox.exec(`pwd`)
      expect(mockBash.exec).toHaveBeenCalledWith(`pwd`, { cwd: `/workspace` })
    })

    it(`should map empty stderr to undefined error`, async () => {
      mockBash.exec.mockResolvedValue({
        exitCode: 0,
        stdout: `ok`,
        stderr: ``,
      })

      const result = await sandbox.exec(`test`)
      expect(result.error).toBeUndefined()
    })
  })

  describe(`readFile`, () => {
    it(`should read file content from virtual FS`, async () => {
      mockFs.readFile.mockResolvedValue(`file contents`)

      const content = await sandbox.readFile(`/workspace/test.txt`)

      expect(mockFs.readFile).toHaveBeenCalledWith(`/workspace/test.txt`, {
        encoding: `utf-8`,
      })
      expect(content).toBe(`file contents`)
    })

    it(`should return string content directly`, async () => {
      mockFs.readFile.mockResolvedValue(`buffer data`)

      const content = await sandbox.readFile(`/workspace/binary.txt`)
      expect(content).toBe(`buffer data`)
    })
  })

  describe(`writeFile`, () => {
    it(`should write content to a file in virtual FS`, async () => {
      await sandbox.writeFile(`/workspace/output.txt`, `data`)

      expect(mockFs.writeFile).toHaveBeenCalledWith(`/workspace/output.txt`, `data`)
    })
  })

  describe(`listDir`, () => {
    it(`should list entries with [DIR] prefix for directories`, async () => {
      mockFs.readdir.mockResolvedValue([`src`, `package.json`, `node_modules`])
      mockFs.stat
        .mockResolvedValueOnce({ isDirectory: true, isFile: false })
        .mockResolvedValueOnce({ isDirectory: false, isFile: true })
        .mockResolvedValueOnce({ isDirectory: true, isFile: false })

      const result = await sandbox.listDir(`/project`)

      expect(result).toEqual([`[DIR] src`, `package.json`, `[DIR] node_modules`])
    })

    it(`should list files without prefix`, async () => {
      mockFs.readdir.mockResolvedValue([`lib`, `index.ts`])
      mockFs.stat
        .mockResolvedValueOnce({ isDirectory: true, isFile: false })
        .mockResolvedValueOnce({ isDirectory: false, isFile: true })

      const result = await sandbox.listDir(`/project`)
      expect(result).toEqual([`[DIR] lib`, `index.ts`])
    })

    it(`should fallback to plain name when stat fails`, async () => {
      mockFs.readdir.mockResolvedValue([`unknown`])
      mockFs.stat.mockRejectedValue(new Error(`no stat`))

      const result = await sandbox.listDir(`/project`)
      expect(result).toEqual([`unknown`])
    })
  })

  describe(`deleteFile`, () => {
    it(`should delete a file from virtual FS`, async () => {
      await sandbox.deleteFile(`/workspace/old.txt`)

      expect(mockFs.rm).toHaveBeenCalledWith(`/workspace/old.txt`)
    })
  })

  describe(`mkdir`, () => {
    it(`should create a directory recursively`, async () => {
      await sandbox.mkdir(`/workspace/deep/nested/dir`)

      expect(mockFs.mkdir).toHaveBeenCalledWith(`/workspace/deep/nested/dir`, {
        recursive: true,
      })
    })
  })

  describe(`fileExists`, () => {
    it(`should return true when file exists`, async () => {
      mockFs.stat.mockResolvedValue({ size: 100 })

      const exists = await sandbox.fileExists(`/workspace/exists.txt`)
      expect(exists).toBe(true)
    })

    it(`should return false when file does not exist`, async () => {
      mockFs.stat.mockRejectedValue(new Error(`not found`))

      const exists = await sandbox.fileExists(`/workspace/nope.txt`)
      expect(exists).toBe(false)
    })
  })

  describe(`close`, () => {
    it(`should dispose the isolate runner`, async () => {
      await sandbox.close()

      expect(mockIsolateRunner.dispose).toHaveBeenCalledOnce()
    })

    it(`should handle null isolate runner gracefully`, async () => {
      const sandboxNoIsolate = new LocalSandbox(mockBash, mockFs, null)
      await expect(sandboxNoIsolate.close()).resolves.not.toThrow()
    })
  })
})

describe(`LocalSandboxProvider`, () => {
  it(`should have type 'local'`, () => {
    const provider = new LocalSandboxProvider()
    expect(provider.type).toBe(`local`)
  })

  it(`should implement ISandboxProvider create method`, () => {
    const provider = new LocalSandboxProvider()
    expect(typeof provider.create).toBe(`function`)
  })
})
