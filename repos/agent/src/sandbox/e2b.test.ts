import { describe, it, expect, vi, beforeEach } from 'vitest'
import { E2bSandbox } from './e2b'

/**
 * Tests for the E2B sandbox wrapper (ISandbox implementation)
 * All methods delegate to the underlying E2B SDK sandbox instance
 * Note: The E2B SDK's sandbox.commands.run is NOT child_process - it runs
 * commands inside an isolated Firecracker microVM via their REST API.
 */
describe(`E2bSandbox`, () => {
  let mockE2BSandbox: any
  let sandbox: E2bSandbox

  beforeEach(() => {
    mockE2BSandbox = {
      commands: {
        run: vi.fn(),
      },
      files: {
        read: vi.fn(),
        write: vi.fn(),
        list: vi.fn(),
        remove: vi.fn(),
        makeDir: vi.fn(),
      },
      kill: vi.fn(),
    }

    sandbox = new E2bSandbox(mockE2BSandbox)
  })

  describe(`sandbox.exec (remote microVM command)`, () => {
    it(`should run a command in the sandbox and return success result`, async () => {
      mockE2BSandbox.commands.run.mockResolvedValue({
        exitCode: 0,
        stdout: `hello world`,
        stderr: ``,
      })

      const result = await sandbox.exec(`echo`, [`hello`, `world`])

      expect(mockE2BSandbox.commands.run).toHaveBeenCalledWith(`echo hello world`)
      expect(result).toEqual({
        success: true,
        output: `hello world`,
        error: undefined,
        exitCode: 0,
      })
    })

    it(`should return failure result for non-zero exit code`, async () => {
      mockE2BSandbox.commands.run.mockResolvedValue({
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
      mockE2BSandbox.commands.run.mockResolvedValue({
        exitCode: 0,
        stdout: `/home`,
        stderr: ``,
      })

      await sandbox.exec(`pwd`)
      expect(mockE2BSandbox.commands.run).toHaveBeenCalledWith(`pwd`)
    })
  })

  describe(`readFile`, () => {
    it(`should read file content from sandbox`, async () => {
      mockE2BSandbox.files.read.mockResolvedValue(`file contents`)

      const content = await sandbox.readFile(`/tmp/test.txt`)

      expect(mockE2BSandbox.files.read).toHaveBeenCalledWith(`/tmp/test.txt`)
      expect(content).toBe(`file contents`)
    })
  })

  describe(`writeFile`, () => {
    it(`should write content to a file in sandbox`, async () => {
      await sandbox.writeFile(`/tmp/output.txt`, `data`)

      expect(mockE2BSandbox.files.write).toHaveBeenCalledWith(`/tmp/output.txt`, `data`)
    })
  })

  describe(`listDir`, () => {
    it(`should list directory entries with [DIR] prefix for directories`, async () => {
      mockE2BSandbox.files.list.mockResolvedValue([
        { name: `src`, type: `dir` },
        { name: `package.json`, type: `file` },
        { name: `node_modules`, type: `dir` },
      ])

      const result = await sandbox.listDir(`/project`)

      expect(result).toEqual([`[DIR] src`, `package.json`, `[DIR] node_modules`])
    })
  })

  describe(`deleteFile`, () => {
    it(`should delete a file from sandbox`, async () => {
      await sandbox.deleteFile(`/tmp/old.txt`)

      expect(mockE2BSandbox.files.remove).toHaveBeenCalledWith(`/tmp/old.txt`)
    })
  })

  describe(`mkdir`, () => {
    it(`should create a directory in sandbox`, async () => {
      await sandbox.mkdir(`/tmp/newdir`)

      expect(mockE2BSandbox.files.makeDir).toHaveBeenCalledWith(`/tmp/newdir`)
    })
  })

  describe(`fileExists`, () => {
    it(`should return true when file exists`, async () => {
      mockE2BSandbox.files.read.mockResolvedValue(`content`)

      const exists = await sandbox.fileExists(`/tmp/exists.txt`)
      expect(exists).toBe(true)
    })

    it(`should return false when file does not exist`, async () => {
      mockE2BSandbox.files.read.mockRejectedValue(new Error(`not found`))

      const exists = await sandbox.fileExists(`/tmp/nope.txt`)
      expect(exists).toBe(false)
    })
  })

  describe(`close`, () => {
    it(`should kill the sandbox`, async () => {
      await sandbox.close()

      expect(mockE2BSandbox.kill).toHaveBeenCalledOnce()
    })
  })
})
