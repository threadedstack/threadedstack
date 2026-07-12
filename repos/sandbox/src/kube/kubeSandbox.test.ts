import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KubeSandbox } from './kubeSandbox'
import { logger } from '@TSB/utils/logger'
import type { TSandboxRuntime } from '@tdsk/domain'

const makeClient = () => ({
  runInPod: vi.fn(),
})

const defaultRuntime: TSandboxRuntime = {
  name: `node`,
  command: `node`,
  extension: `.js`,
}

describe(`KubeSandbox`, () => {
  let mockClient: ReturnType<typeof makeClient>
  let sandbox: KubeSandbox

  beforeEach(() => {
    mockClient = makeClient()
    sandbox = new KubeSandbox(mockClient as any, `test-pod`, [defaultRuntime], `node`)
  })

  describe(`exec`, () => {
    it(`should run commands via K8s API`, async () => {
      mockClient.runInPod.mockResolvedValue({
        success: true,
        output: `hello`,
      })

      const result = await sandbox.exec(`echo hello`)

      expect(mockClient.runInPod).toHaveBeenCalledWith(`test-pod`, [
        `sh`,
        `-c`,
        `echo hello`,
      ])
      expect(result.success).toBe(true)
      expect(result.output).toBe(`hello`)
    })

    it(`should join args into the command string`, async () => {
      mockClient.runInPod.mockResolvedValue({
        success: true,
        output: ``,
      })

      await sandbox.exec(`echo`, [`hello`, `world`])

      expect(mockClient.runInPod).toHaveBeenCalledWith(`test-pod`, [
        `sh`,
        `-c`,
        `echo hello world`,
      ])
    })

    it(`should handle command with no args`, async () => {
      mockClient.runInPod.mockResolvedValue({
        success: true,
        output: `/workspace`,
      })

      await sandbox.exec(`pwd`)

      expect(mockClient.runInPod).toHaveBeenCalledWith(`test-pod`, [`sh`, `-c`, `pwd`])
    })

    it(`should forward the signal to runInPod's opts when provided`, async () => {
      mockClient.runInPod.mockResolvedValue({
        success: true,
        output: ``,
      })
      const controller = new AbortController()

      await sandbox.exec(`echo hello`, undefined, controller.signal)

      expect(mockClient.runInPod).toHaveBeenCalledWith(
        `test-pod`,
        [`sh`, `-c`, `echo hello`],
        undefined,
        { signal: controller.signal }
      )
    })
  })

  describe(`readFile`, () => {
    it(`should read file via cat command`, async () => {
      mockClient.runInPod.mockResolvedValue({
        success: true,
        output: `file contents`,
      })

      const content = await sandbox.readFile(`/workspace/test.txt`)

      expect(mockClient.runInPod).toHaveBeenCalledWith(`test-pod`, [
        `cat`,
        `/workspace/test.txt`,
      ])
      expect(content).toBe(`file contents`)
    })

    it(`should throw on failure`, async () => {
      mockClient.runInPod.mockResolvedValue({
        success: false,
        output: ``,
        error: `No such file`,
      })

      await expect(sandbox.readFile(`/workspace/missing.txt`)).rejects.toThrow(
        `No such file`
      )
    })

    it(`should throw with default message when error is empty`, async () => {
      mockClient.runInPod.mockResolvedValue({
        success: false,
        output: ``,
        error: ``,
      })

      await expect(sandbox.readFile(`/workspace/missing.txt`)).rejects.toThrow(
        `Failed to read file: /workspace/missing.txt`
      )
    })
  })

  describe(`writeFile`, () => {
    it(`should write via printf/sh command`, async () => {
      mockClient.runInPod.mockResolvedValue({
        success: true,
        output: ``,
      })

      await sandbox.writeFile(`/workspace/out.txt`, `hello world`)

      expect(mockClient.runInPod).toHaveBeenCalledWith(`test-pod`, [
        `sh`,
        `-c`,
        `printf '%s' 'hello world' > '/workspace/out.txt'`,
      ])
    })

    it(`should escape single quotes in content`, async () => {
      mockClient.runInPod.mockResolvedValue({
        success: true,
        output: ``,
      })

      await sandbox.writeFile(`/workspace/out.txt`, `it's a test`)

      expect(mockClient.runInPod).toHaveBeenCalledWith(`test-pod`, [
        `sh`,
        `-c`,
        `printf '%s' 'it'\\''s a test' > '/workspace/out.txt'`,
      ])
    })

    it(`should escape single quotes in path`, async () => {
      mockClient.runInPod.mockResolvedValue({
        success: true,
        output: ``,
      })

      await sandbox.writeFile(`/workspace/it's here.txt`, `data`)

      expect(mockClient.runInPod).toHaveBeenCalledWith(`test-pod`, [
        `sh`,
        `-c`,
        `printf '%s' 'data' > '/workspace/it'\\''s here.txt'`,
      ])
    })

    it(`should throw on failure`, async () => {
      mockClient.runInPod.mockResolvedValue({
        success: false,
        output: ``,
        error: `Permission denied`,
      })

      await expect(sandbox.writeFile(`/workspace/out.txt`, `data`)).rejects.toThrow(
        `Permission denied`
      )
    })
  })

  describe(`fileExists`, () => {
    it(`should return true when test -e succeeds`, async () => {
      mockClient.runInPod.mockResolvedValue({ success: true, output: `` })

      const exists = await sandbox.fileExists(`/workspace/exists.txt`)

      expect(mockClient.runInPod).toHaveBeenCalledWith(`test-pod`, [
        `test`,
        `-e`,
        `/workspace/exists.txt`,
      ])
      expect(exists).toBe(true)
    })

    it(`should return false when test -e fails`, async () => {
      mockClient.runInPod.mockResolvedValue({ success: false, output: `` })

      const exists = await sandbox.fileExists(`/workspace/nope.txt`)
      expect(exists).toBe(false)
    })
  })

  describe(`mkdir`, () => {
    it(`should create directory via mkdir -p`, async () => {
      mockClient.runInPod.mockResolvedValue({ success: true, output: `` })

      await sandbox.mkdir(`/workspace/deep/nested`)

      expect(mockClient.runInPod).toHaveBeenCalledWith(`test-pod`, [
        `mkdir`,
        `-p`,
        `/workspace/deep/nested`,
      ])
    })

    it(`should throw on failure`, async () => {
      mockClient.runInPod.mockResolvedValue({
        success: false,
        output: ``,
        error: `Permission denied`,
      })

      await expect(sandbox.mkdir(`/workspace/dir`)).rejects.toThrow(`Permission denied`)
    })
  })

  describe(`deleteFile`, () => {
    it(`should delete via rm -rf`, async () => {
      mockClient.runInPod.mockResolvedValue({ success: true, output: `` })

      await sandbox.deleteFile(`/workspace/old.txt`)

      expect(mockClient.runInPod).toHaveBeenCalledWith(`test-pod`, [
        `rm`,
        `-rf`,
        `/workspace/old.txt`,
      ])
    })

    it(`should throw on failure`, async () => {
      mockClient.runInPod.mockResolvedValue({
        success: false,
        output: ``,
        error: `Cannot remove`,
      })

      await expect(sandbox.deleteFile(`/workspace/locked.txt`)).rejects.toThrow(
        `Cannot remove`
      )
    })
  })

  describe(`evaluate`, () => {
    it(`should write temp file and run with runtime`, async () => {
      // mkdir for temp dir
      mockClient.runInPod.mockResolvedValueOnce({ success: true, output: `` })
      // writeFile for main code
      mockClient.runInPod.mockResolvedValueOnce({ success: true, output: `` })
      // run the runtime command via sandbox.exec
      mockClient.runInPod.mockResolvedValueOnce({
        success: true,
        output: `42`,
        error: undefined,
      })
      // cleanup rm -rf
      mockClient.runInPod.mockResolvedValueOnce({ success: true, output: `` })

      const result = await sandbox.evaluate(`console.log(42)`)

      expect(result.output).toBe(`42`)
      expect(result.error).toBeUndefined()
      expect(result.result).toBeUndefined()

      // Verify mkdir was called for a temp dir
      const mkdirCall = mockClient.runInPod.mock.calls[0]
      expect(mkdirCall[1]).toEqual([
        `mkdir`,
        `-p`,
        expect.stringContaining(`/tmp/tdsk-eval-`),
      ])

      // Verify the runtime run call uses node and the main file path
      const runCall = mockClient.runInPod.mock.calls[2]
      expect(runCall[1][2]).toMatch(/node \/tmp\/tdsk-eval-.*\/main\.js/)
    })

    it(`should write module files before main when modules provided`, async () => {
      // mkdir
      mockClient.runInPod.mockResolvedValueOnce({ success: true, output: `` })
      // writeFile for module 'utils'
      mockClient.runInPod.mockResolvedValueOnce({ success: true, output: `` })
      // writeFile for main
      mockClient.runInPod.mockResolvedValueOnce({ success: true, output: `` })
      // run command
      mockClient.runInPod.mockResolvedValueOnce({ success: true, output: `ok` })
      // cleanup
      mockClient.runInPod.mockResolvedValueOnce({ success: true, output: `` })

      await sandbox.evaluate(`import u from './utils'; console.log(u)`, {
        modules: { utils: `export default 'ok'` },
      })

      // The module write should use the runtime extension
      const moduleWriteCall = mockClient.runInPod.mock.calls[1]
      expect(moduleWriteCall[1][2]).toContain(`utils.js`)
    })

    it(`should throw when requested runtime is not available`, async () => {
      await expect(
        sandbox.evaluate(`code`, { runtime: `python` } as any)
      ).rejects.toThrow(`Runtime "python" not available`)
    })

    it(`should include timeout flag when timeout provided`, async () => {
      mockClient.runInPod.mockResolvedValue({ success: true, output: `` })

      await sandbox.evaluate(`console.log(1)`, { timeout: 5000 })

      // The run call (3rd call) should include timeout prefix
      const runCall = mockClient.runInPod.mock.calls[2]
      expect(runCall[1][2]).toMatch(/^timeout 5 node/)
    })

    it(`should clean up temp directory after evaluation`, async () => {
      mockClient.runInPod.mockResolvedValue({ success: true, output: `` })

      await sandbox.evaluate(`console.log('test')`)

      // Last call should be the cleanup
      const calls = mockClient.runInPod.mock.calls
      const cleanupCall = calls[calls.length - 1]
      expect(cleanupCall[1][2]).toMatch(/rm -rf \/tmp\/tdsk-eval-/)
    })

    it(`should return error info from execution result`, async () => {
      mockClient.runInPod.mockResolvedValueOnce({ success: true, output: `` })
      mockClient.runInPod.mockResolvedValueOnce({ success: true, output: `` })
      mockClient.runInPod.mockResolvedValueOnce({
        success: false,
        output: ``,
        error: `SyntaxError: Unexpected token`,
        exitCode: 1,
      })
      mockClient.runInPod.mockResolvedValueOnce({ success: true, output: `` })

      const result = await sandbox.evaluate(`invalid(`)

      expect(result.error).toBe(`SyntaxError: Unexpected token`)
      expect(result.output).toBe(``)
    })

    it(`should log error when temp cleanup fails`, async () => {
      const errorSpy = vi.spyOn(logger, `error`).mockImplementation(() => {})
      mockClient.runInPod.mockResolvedValueOnce({ success: true, output: `` })
      mockClient.runInPod.mockResolvedValueOnce({ success: true, output: `` })
      mockClient.runInPod.mockResolvedValueOnce({ success: true, output: `ok` })
      mockClient.runInPod.mockResolvedValueOnce({
        success: false,
        error: `Permission denied`,
      })

      await sandbox.evaluate(`console.log('ok')`)

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`[KubeSandbox] Temp cleanup failed`),
        expect.stringContaining(`Permission denied`)
      )
      errorSpy.mockRestore()
    })
  })

  describe(`close`, () => {
    it(`should not call any client methods (persistent workspace)`, async () => {
      await sandbox.close()
      expect(mockClient.runInPod).not.toHaveBeenCalled()
    })
  })

  describe(`reset`, () => {
    it(`should clear workspace and temp directories`, async () => {
      mockClient.runInPod.mockResolvedValue({ success: true, output: `` })

      await sandbox.reset()

      expect(mockClient.runInPod).toHaveBeenCalledWith(`test-pod`, [
        `sh`,
        `-c`,
        `rm -rf /workspace/* /tmp/*`,
      ])
    })

    it(`should throw with context when reset fails`, async () => {
      mockClient.runInPod.mockResolvedValue({
        success: false,
        error: `Device or resource busy`,
      })

      await expect(sandbox.reset()).rejects.toThrow(
        `Failed to reset sandbox: Device or resource busy`
      )
    })
  })

  describe(`listDir`, () => {
    it(`should list entries with [DIR] prefix for directories`, async () => {
      mockClient.runInPod.mockResolvedValueOnce({
        success: true,
        output: `./\n../\nsrc/\nindex.ts`,
      })

      const result = await sandbox.listDir(`/workspace`)

      expect(result).toEqual([`[DIR] src`, `index.ts`])
      expect(mockClient.runInPod).toHaveBeenCalledWith(`test-pod`, [
        `ls`,
        `-1aF`,
        `/workspace`,
      ])
    })

    it(`should strip trailing indicator characters from files`, async () => {
      mockClient.runInPod.mockResolvedValueOnce({
        success: true,
        output: `script.sh*\nlink@\nfile.txt`,
      })

      const result = await sandbox.listDir(`/workspace`)
      expect(result).toEqual([`script.sh`, `link`, `file.txt`])
    })

    it(`should throw on ls failure`, async () => {
      mockClient.runInPod.mockResolvedValue({
        success: false,
        output: ``,
        error: `No such directory`,
      })

      await expect(sandbox.listDir(`/nonexistent`)).rejects.toThrow(`No such directory`)
    })
  })
})
