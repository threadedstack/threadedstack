import { ESandboxType } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Bash, InMemoryFs } from 'just-bash'
import { LocalSandbox, LocalSandboxProvider } from '.'
import { gitCommand } from '../git'

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
      releaseUserModules: vi.fn(),
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

  describe(`evaluate`, () => {
    it(`should call isolateRunner eval with code and timeout`, async () => {
      mockIsolateRunner.eval = vi.fn().mockResolvedValue({
        output: `logged`,
        result: 42,
      })

      const result = await sandbox.evaluate(`export default 42`, { timeout: 10000 })

      expect(mockIsolateRunner.eval).toHaveBeenCalledWith(
        `export default 42`,
        10000,
        undefined
      )
      expect(result).toEqual({ output: `logged`, result: 42 })
    })

    it(`should use default timeout when not specified`, async () => {
      mockIsolateRunner.eval = vi.fn().mockResolvedValue({
        output: ``,
        result: undefined,
      })

      await sandbox.evaluate(`const x = 1`)

      expect(mockIsolateRunner.eval).toHaveBeenCalledWith(
        `const x = 1`,
        undefined,
        undefined
      )
    })

    it(`should forward host bridges to isolateRunner eval`, async () => {
      const bridges = { 'records.query': vi.fn(async () => `[]`) }
      mockIsolateRunner.eval = vi.fn().mockResolvedValue({ output: ``, result: null })

      await sandbox.evaluate(`export default 1`, { timeout: 5000, bridges })

      expect(mockIsolateRunner.eval).toHaveBeenCalledWith(
        `export default 1`,
        5000,
        bridges
      )
    })

    it(`should register modules before evaluation`, async () => {
      mockIsolateRunner.registerModule = vi.fn().mockResolvedValue(undefined)
      mockIsolateRunner.eval = vi.fn().mockResolvedValue({
        output: ``,
        result: `ok`,
      })

      await sandbox.evaluate(`import fn from 'mymod'; export default fn()`, {
        modules: { mymod: `export default () => 'ok'` },
      })

      expect(mockIsolateRunner.registerModule).toHaveBeenCalledWith(
        `mymod`,
        `export default () => 'ok'`
      )
      expect(mockIsolateRunner.eval).toHaveBeenCalled()
    })

    it(`should register multiple modules`, async () => {
      mockIsolateRunner.registerModule = vi.fn().mockResolvedValue(undefined)
      mockIsolateRunner.eval = vi.fn().mockResolvedValue({
        output: ``,
        result: undefined,
      })

      await sandbox.evaluate(`import a from 'a'; import b from 'b'`, {
        modules: { a: `export default 1`, b: `export default 2` },
      })

      expect(mockIsolateRunner.registerModule).toHaveBeenCalledTimes(2)
      expect(mockIsolateRunner.registerModule).toHaveBeenCalledWith(
        `a`,
        `export default 1`
      )
      expect(mockIsolateRunner.registerModule).toHaveBeenCalledWith(
        `b`,
        `export default 2`
      )
    })

    it(`should throw when isolateRunner is null`, async () => {
      const sandboxNoIsolate = new LocalSandbox(mockBash, mockFs, null)

      await expect(sandboxNoIsolate.evaluate(`code`)).rejects.toThrow(
        `Code execution not available`
      )
    })
  })

  describe(`reset`, () => {
    it(`should clear all files in /workspace on reset()`, async () => {
      mockFs.readdir.mockImplementation(async (dir: string) => {
        if (dir === `/workspace`) return [`file1.txt`, `file2.txt`]
        return []
      })

      await sandbox.reset()

      expect(mockFs.rm).toHaveBeenCalledWith(`/workspace/file1.txt`)
      expect(mockFs.rm).toHaveBeenCalledWith(`/workspace/file2.txt`)
    })

    it(`should clear all files in /tmp on reset()`, async () => {
      mockFs.readdir.mockImplementation(async (dir: string) => {
        if (dir === `/tmp`) return [`temp1.dat`, `temp2.dat`]
        return []
      })

      await sandbox.reset()

      expect(mockFs.rm).toHaveBeenCalledWith(`/tmp/temp1.dat`)
      expect(mockFs.rm).toHaveBeenCalledWith(`/tmp/temp2.dat`)
    })

    it(`should not throw if directories are empty`, async () => {
      mockFs.readdir.mockResolvedValue([])

      await expect(sandbox.reset()).resolves.not.toThrow()
      expect(mockFs.rm).not.toHaveBeenCalled()
    })

    it(`should not throw if directories don't exist`, async () => {
      mockFs.readdir.mockRejectedValue(new Error(`ENOENT: no such file or directory`))

      await expect(sandbox.reset()).resolves.not.toThrow()
    })

    it(`should keep /workspace and /tmp directories themselves (just clear contents)`, async () => {
      mockFs.readdir.mockImplementation(async (dir: string) => {
        if (dir === `/workspace`) return [`src`]
        if (dir === `/tmp`) return [`cache`]
        return []
      })

      await sandbox.reset()

      // rm is called on entries inside the directories, not the directories themselves
      expect(mockFs.rm).toHaveBeenCalledWith(`/workspace/src`)
      expect(mockFs.rm).toHaveBeenCalledWith(`/tmp/cache`)
      expect(mockFs.rm).not.toHaveBeenCalledWith(`/workspace`)
      expect(mockFs.rm).not.toHaveBeenCalledWith(`/tmp`)
    })

    it(`should call releaseUserModules on isolateRunner during reset`, async () => {
      mockFs.readdir.mockResolvedValue([])

      await sandbox.reset()

      expect(mockIsolateRunner.releaseUserModules).toHaveBeenCalledOnce()
    })

    it(`should handle null isolateRunner during reset gracefully`, async () => {
      const sandboxNoIsolate = new LocalSandbox(mockBash, mockFs, null)
      mockFs.readdir.mockResolvedValue([])

      await expect(sandboxNoIsolate.reset()).resolves.not.toThrow()
    })

    it(`should continue clearing remaining files when one rm fails`, async () => {
      mockFs.readdir.mockImplementation(async (dir: string) => {
        if (dir === `/workspace`) return [`locked.txt`, `deletable.txt`]
        return []
      })
      mockFs.rm.mockImplementation(async (path: string) => {
        if (path === `/workspace/locked.txt`) throw new Error(`permission denied`)
      })

      await expect(sandbox.reset()).resolves.not.toThrow()
      expect(mockFs.rm).toHaveBeenCalledWith(`/workspace/deletable.txt`)
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
    expect(provider.type).toBe(ESandboxType.local)
  })

  it(`should implement ISandboxProvider create method`, () => {
    const provider = new LocalSandboxProvider()
    expect(typeof provider.create).toBe(`function`)
  })
})

describe(`LocalSandbox git integration`, () => {
  it(`should run full git workflow: init → add → commit → status → log → branch → checkout`, async () => {
    const fs = new InMemoryFs()
    await fs.mkdir(`/workspace`, { recursive: true })

    const bash = new Bash({
      fs,
      cwd: `/workspace`,
      customCommands: [gitCommand],
    })
    const sandbox = new LocalSandbox(bash, fs, null)

    // git init
    let result = await sandbox.exec(`git init`)
    expect(result.success).toBe(true)
    expect(result.output).toContain(`Initialized empty Git repository`)

    // Write a file
    await sandbox.writeFile(`/workspace/hello.txt`, `Hello, World!`)

    // git status — should show untracked
    result = await sandbox.exec(`git status`)
    expect(result.success).toBe(true)
    expect(result.output).toContain(`Untracked files:`)
    expect(result.output).toContain(`hello.txt`)

    // git add .
    result = await sandbox.exec(`git add .`)
    expect(result.success).toBe(true)

    // git status — should show staged
    result = await sandbox.exec(`git status`)
    expect(result.output).toContain(`Changes to be committed:`)
    expect(result.output).toContain(`new file:   hello.txt`)

    // git commit
    result = await sandbox.exec(`git commit -m "initial commit"`)
    expect(result.success).toBe(true)
    expect(result.output).toContain(`initial commit`)

    // git status — should be clean
    result = await sandbox.exec(`git status`)
    expect(result.output).toContain(`nothing to commit, working tree clean`)

    // git log --oneline
    result = await sandbox.exec(`git log --oneline`)
    expect(result.success).toBe(true)
    expect(result.output).toContain(`initial commit`)

    // git branch feature
    result = await sandbox.exec(`git branch feature`)
    expect(result.success).toBe(true)

    // git branch (list)
    result = await sandbox.exec(`git branch`)
    expect(result.output).toContain(`* main`)
    expect(result.output).toContain(`feature`)

    // git checkout feature
    result = await sandbox.exec(`git checkout feature`)
    expect(result.success).toBe(true)
    expect(result.output).toContain(`Switched to branch 'feature'`)

    // Write another file on feature branch
    await sandbox.writeFile(`/workspace/feature.txt`, `Feature work`)

    // git add and commit on feature
    result = await sandbox.exec(`git add .`)
    expect(result.success).toBe(true)
    result = await sandbox.exec(`git commit -m "add feature file"`)
    expect(result.success).toBe(true)

    // Switch back to main
    result = await sandbox.exec(`git checkout main`)
    expect(result.success).toBe(true)

    // feature.txt should not exist on main
    const exists = await sandbox.fileExists(`/workspace/feature.txt`)
    expect(exists).toBe(false)

    // git log on main — should only show initial commit
    result = await sandbox.exec(`git log --oneline`)
    expect(result.output).toContain(`initial commit`)
    expect(result.output).not.toContain(`add feature file`)
  })

  it(`should handle git checkout -b (create + switch)`, async () => {
    const fs = new InMemoryFs()
    await fs.mkdir(`/workspace`, { recursive: true })

    const bash = new Bash({
      fs,
      cwd: `/workspace`,
      customCommands: [gitCommand],
    })
    const sandbox = new LocalSandbox(bash, fs, null)

    await sandbox.exec(`git init`)
    await sandbox.writeFile(`/workspace/file.txt`, `content`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "first"`)

    const result = await sandbox.exec(`git checkout -b new-branch`)
    expect(result.success).toBe(true)
    expect(result.output).toContain(`Switched to a new branch 'new-branch'`)

    // Verify we're on the new branch
    const branchResult = await sandbox.exec(`git rev-parse --abbrev-ref HEAD`)
    expect(branchResult.output.trim()).toBe(`new-branch`)
  })

  it(`should handle git diff showing changed files`, async () => {
    const fs = new InMemoryFs()
    await fs.mkdir(`/workspace`, { recursive: true })

    const bash = new Bash({
      fs,
      cwd: `/workspace`,
      customCommands: [gitCommand],
    })
    const sandbox = new LocalSandbox(bash, fs, null)

    await sandbox.exec(`git init`)
    await sandbox.writeFile(`/workspace/file.txt`, `original`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "initial"`)

    // Modify file
    await sandbox.writeFile(`/workspace/file.txt`, `modified`)

    const result = await sandbox.exec(`git diff`)
    expect(result.success).toBe(true)
    expect(result.output).toContain(`modified: file.txt`)
  })
})
