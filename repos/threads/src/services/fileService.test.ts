import type { TFileCtx } from '@TTH/types'
import type { TApiRes } from '@TTH/types'
import type { TSandboxResult } from '@tdsk/domain'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EFileOp } from '@tdsk/domain'

const mockFileOp = vi.fn()

vi.mock(`@TTH/services/sandboxApi`, () => ({
  sandboxApi: {
    fileOp: (...args: unknown[]) => mockFileOp(...args),
  },
}))

import { fileService } from './fileService'

const ctx: TFileCtx = {
  orgId: `org-1`,
  projectId: `project-1`,
  sandboxId: `sandbox-1`,
  instanceId: `instance-1`,
}

const makeResult = (
  overrides: Partial<TSandboxResult> = {}
): TApiRes<TSandboxResult> => ({
  data: { output: ``, success: true, exitCode: 0, ...overrides },
})

describe(`FileService`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe(`listDir`, () => {
    it(`parses files, folders, ./.. entries, and glob-suffixed names into TFileEntry[]`, async () => {
      mockFileOp.mockResolvedValueOnce(
        makeResult({
          output: [
            `.`,
            `..`,
            `./`,
            `../`,
            `foo.txt`,
            `bar/`,
            `baz*`,
            `qux@`,
            `quux=`,
            `corge|`,
          ].join(`\n`),
        })
      )

      const entries = await fileService.listDir(ctx, `/root`)

      expect(entries).toEqual([
        { name: `foo.txt`, path: `/root/foo.txt`, type: `file` },
        { name: `bar`, path: `/root/bar`, type: `folder` },
        { name: `baz`, path: `/root/baz`, type: `file` },
        { name: `qux`, path: `/root/qux`, type: `file` },
        { name: `quux`, path: `/root/quux`, type: `file` },
        { name: `corge`, path: `/root/corge`, type: `file` },
      ])
      expect(mockFileOp).toHaveBeenCalledWith(`org-1`, `project-1`, `sandbox-1`, {
        fileChange: { op: EFileOp.list, path: `/root` },
        instanceId: `instance-1`,
      })
    })

    it(`joins path without a double slash when dirPath already ends in /`, async () => {
      mockFileOp.mockResolvedValueOnce(makeResult({ output: `foo.txt` }))

      const entries = await fileService.listDir(ctx, `/root/`)

      expect(entries).toEqual([{ name: `foo.txt`, path: `/root/foo.txt`, type: `file` }])
    })
  })

  describe(`assertExecOk failure modes (via readFile/writeFile)`, () => {
    it(`throws the transport error message on a transport-level resp.error`, async () => {
      mockFileOp.mockResolvedValueOnce({ error: { message: `network down` } })

      await expect(fileService.readFile(ctx, `/f.txt`)).rejects.toThrow(`network down`)
    })

    it(`throws a generic 'No response from <label>' error when resp.data is missing`, async () => {
      mockFileOp.mockResolvedValueOnce({})

      await expect(fileService.readFile(ctx, `/f.txt`)).rejects.toThrow(
        `No response from readFile for /f.txt`
      )
    })

    it(`throws using resp.data.error on a non-zero exit code`, async () => {
      mockFileOp.mockResolvedValueOnce(
        makeResult({ exitCode: 1, error: `permission denied` })
      )

      await expect(fileService.writeFile(ctx, `/f.txt`, `content`)).rejects.toThrow(
        `permission denied`
      )
    })

    it(`throws a generic exit-code message when resp.data.error is absent on a non-zero exit`, async () => {
      mockFileOp.mockResolvedValueOnce(makeResult({ exitCode: 2, error: undefined }))

      await expect(fileService.writeFile(ctx, `/f.txt`, `content`)).rejects.toThrow(
        `writeFile failed (exit 2)`
      )
    })

    it(`resolves readFile's output on a successful exit`, async () => {
      mockFileOp.mockResolvedValueOnce(makeResult({ output: `hello` }))

      await expect(fileService.readFile(ctx, `/f.txt`)).resolves.toBe(`hello`)
    })
  })

  describe(`fileExists`, () => {
    it(`returns true on exit code 0`, async () => {
      mockFileOp.mockResolvedValueOnce(makeResult({ exitCode: 0 }))

      await expect(fileService.fileExists(ctx, `/f.txt`)).resolves.toBe(true)
    })

    it(`returns false on exit code 1`, async () => {
      mockFileOp.mockResolvedValueOnce(makeResult({ exitCode: 1 }))

      await expect(fileService.fileExists(ctx, `/f.txt`)).resolves.toBe(false)
    })

    it(`throws on any other exit code`, async () => {
      mockFileOp.mockResolvedValueOnce(
        makeResult({ exitCode: 2, error: `weird failure` })
      )

      await expect(fileService.fileExists(ctx, `/f.txt`)).rejects.toThrow(`weird failure`)
    })

    it(`throws a transport error directly, bypassing assertExecOk's shared path`, async () => {
      mockFileOp.mockResolvedValueOnce({ error: { message: `network down` } })

      await expect(fileService.fileExists(ctx, `/f.txt`)).rejects.toThrow(`network down`)
    })
  })

  describe(`fileSize`, () => {
    it(`parses a leading integer out of the command output`, async () => {
      mockFileOp.mockResolvedValueOnce(makeResult({ output: `1024\n` }))

      await expect(fileService.fileSize(ctx, `/f.txt`)).resolves.toBe(1024)
    })

    it(`throws a clear error when the output doesn't start with a number`, async () => {
      mockFileOp.mockResolvedValueOnce(makeResult({ output: `not-a-number` }))

      await expect(fileService.fileSize(ctx, `/f.txt`)).rejects.toThrow(
        `Could not parse file size from: "not-a-number"`
      )
    })
  })
})
