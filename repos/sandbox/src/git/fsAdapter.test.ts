import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGitFsAdapter } from './fsAdapter'

describe(`createGitFsAdapter`, () => {
  let mockFs: any
  let adapter: ReturnType<typeof createGitFsAdapter>

  beforeEach(() => {
    mockFs = {
      readFile: vi.fn(),
      readFileBuffer: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      rm: vi.fn(),
      stat: vi.fn(),
      lstat: vi.fn(),
      readdir: vi.fn(),
      readlink: vi.fn(),
      symlink: vi.fn(),
    }
    adapter = createGitFsAdapter(mockFs)
  })

  describe(`readFile`, () => {
    it(`should call readFileBuffer when no encoding is specified`, async () => {
      const data = new Uint8Array([1, 2, 3])
      mockFs.readFileBuffer.mockResolvedValue(data)

      const result = await adapter.promises.readFile(`/test.bin`)

      expect(mockFs.readFileBuffer).toHaveBeenCalledWith(`/test.bin`)
      expect(result).toBe(data)
    })

    it(`should call readFile with encoding when options object has encoding`, async () => {
      mockFs.readFile.mockResolvedValue(`content`)

      const result = await adapter.promises.readFile(`/test.txt`, {
        encoding: `utf8`,
      })

      expect(mockFs.readFile).toHaveBeenCalledWith(`/test.txt`, {
        encoding: `utf8`,
      })
      expect(result).toBe(`content`)
    })

    it(`should call readFile when encoding is passed as string`, async () => {
      mockFs.readFile.mockResolvedValue(`text`)

      const result = await adapter.promises.readFile(`/file`, `utf8`)

      expect(mockFs.readFile).toHaveBeenCalledWith(`/file`, {
        encoding: `utf8`,
      })
      expect(result).toBe(`text`)
    })

    it(`should call readFileBuffer when encoding is undefined in options`, async () => {
      const data = new Uint8Array([4, 5])
      mockFs.readFileBuffer.mockResolvedValue(data)

      const result = await adapter.promises.readFile(`/bin`, {})

      expect(mockFs.readFileBuffer).toHaveBeenCalledWith(`/bin`)
      expect(result).toBe(data)
    })
  })

  describe(`writeFile`, () => {
    it(`should pass string content to fs.writeFile`, async () => {
      await adapter.promises.writeFile(`/out.txt`, `data`)

      expect(mockFs.writeFile).toHaveBeenCalledWith(`/out.txt`, `data`)
    })

    it(`should pass Uint8Array content to fs.writeFile`, async () => {
      const buf = new Uint8Array([10, 20])
      await adapter.promises.writeFile(`/out.bin`, buf)

      expect(mockFs.writeFile).toHaveBeenCalledWith(`/out.bin`, buf)
    })
  })

  describe(`mkdir`, () => {
    it(`should call fs.mkdir with recursive: true`, async () => {
      await adapter.promises.mkdir(`/new/dir`)

      expect(mockFs.mkdir).toHaveBeenCalledWith(`/new/dir`, {
        recursive: true,
      })
    })

    it(`should ignore numeric mode argument`, async () => {
      await adapter.promises.mkdir(`/dir`, 0o777)

      expect(mockFs.mkdir).toHaveBeenCalledWith(`/dir`, { recursive: true })
    })
  })

  describe(`rmdir`, () => {
    it(`should map rmdir to fs.rm`, async () => {
      await adapter.promises.rmdir(`/old`)

      expect(mockFs.rm).toHaveBeenCalledWith(`/old`)
    })
  })

  describe(`unlink`, () => {
    it(`should map unlink to fs.rm`, async () => {
      await adapter.promises.unlink(`/file.txt`)

      expect(mockFs.rm).toHaveBeenCalledWith(`/file.txt`)
    })
  })

  describe(`stat`, () => {
    it(`should wrap FsStat with method-based isFile/isDirectory/isSymbolicLink`, async () => {
      mockFs.stat.mockResolvedValue({
        isFile: true,
        isDirectory: false,
        isSymbolicLink: false,
        mode: 0o644,
        size: 100,
        mtime: new Date(1700000000000),
      })

      const stat = await adapter.promises.stat(`/file`)

      expect(stat.isFile()).toBe(true)
      expect(stat.isDirectory()).toBe(false)
      expect(stat.isSymbolicLink()).toBe(false)
      expect(stat.size).toBe(100)
      expect(stat.mode).toBe(0o644)
      expect(stat.mtimeMs).toBe(1700000000000)
      expect(stat.ctimeMs).toBe(1700000000000)
      expect(stat.uid).toBe(1)
      expect(stat.gid).toBe(1)
      expect(stat.dev).toBe(1)
      expect(stat.ino).toBe(1700000000000)
    })

    it(`should wrap directory stat correctly`, async () => {
      mockFs.stat.mockResolvedValue({
        isFile: false,
        isDirectory: true,
        isSymbolicLink: false,
        mode: 0o755,
        size: 0,
        mtime: new Date(1600000000000),
      })

      const stat = await adapter.promises.stat(`/dir`)

      expect(stat.isFile()).toBe(false)
      expect(stat.isDirectory()).toBe(true)
    })
  })

  describe(`lstat`, () => {
    it(`should wrap lstat result with methods`, async () => {
      mockFs.lstat.mockResolvedValue({
        isFile: false,
        isDirectory: false,
        isSymbolicLink: true,
        mode: 0o777,
        size: 10,
        mtime: new Date(1500000000000),
      })

      const stat = await adapter.promises.lstat(`/link`)

      expect(stat.isSymbolicLink()).toBe(true)
      expect(stat.isFile()).toBe(false)
      expect(stat.isDirectory()).toBe(false)
    })
  })

  describe(`readdir`, () => {
    it(`should pass through to fs.readdir`, async () => {
      mockFs.readdir.mockResolvedValue([`a.txt`, `b.txt`])

      const result = await adapter.promises.readdir(`/dir`)

      expect(mockFs.readdir).toHaveBeenCalledWith(`/dir`)
      expect(result).toEqual([`a.txt`, `b.txt`])
    })
  })

  describe(`readlink`, () => {
    it(`should pass through to fs.readlink`, async () => {
      mockFs.readlink.mockResolvedValue(`/target`)

      const result = await adapter.promises.readlink(`/link`)

      expect(mockFs.readlink).toHaveBeenCalledWith(`/link`)
      expect(result).toBe(`/target`)
    })
  })

  describe(`symlink`, () => {
    it(`should pass through to fs.symlink`, async () => {
      await adapter.promises.symlink(`/target`, `/link`)

      expect(mockFs.symlink).toHaveBeenCalledWith(`/target`, `/link`)
    })
  })

  describe(`error code fixing`, () => {
    it(`should set .code = ENOENT on stat errors with ENOENT in message`, async () => {
      const err = new Error(`ENOENT: no such file or directory, stat '/missing'`)
      mockFs.stat.mockRejectedValue(err)

      try {
        await adapter.promises.stat(`/missing`)
        expect.fail(`should have thrown`)
      } catch (e: any) {
        expect(e.code).toBe(`ENOENT`)
        expect(e.message).toContain(`ENOENT`)
      }
    })

    it(`should set .code = ENOENT on readFile errors`, async () => {
      const err = new Error(`ENOENT: no such file`)
      mockFs.readFileBuffer.mockRejectedValue(err)

      try {
        await adapter.promises.readFile(`/missing`)
        expect.fail(`should have thrown`)
      } catch (e: any) {
        expect(e.code).toBe(`ENOENT`)
      }
    })

    it(`should set .code = ENOTDIR on lstat errors`, async () => {
      const err = new Error(`ENOTDIR: not a directory`)
      mockFs.lstat.mockRejectedValue(err)

      try {
        await adapter.promises.lstat(`/bad`)
        expect.fail(`should have thrown`)
      } catch (e: any) {
        expect(e.code).toBe(`ENOTDIR`)
      }
    })

    it(`should not override existing .code`, async () => {
      const err: any = new Error(`something`)
      err.code = `CUSTOM`
      mockFs.stat.mockRejectedValue(err)

      try {
        await adapter.promises.stat(`/x`)
        expect.fail(`should have thrown`)
      } catch (e: any) {
        expect(e.code).toBe(`CUSTOM`)
      }
    })

    it(`should propagate errors without recognized codes`, async () => {
      const err = new Error(`unknown error`)
      mockFs.readdir.mockRejectedValue(err)

      await expect(adapter.promises.readdir(`/bad`)).rejects.toThrow(`unknown error`)
    })

    it(`should set .code = ENOTEMPTY on errors with ENOTEMPTY in message`, async () => {
      const err = new Error(`ENOTEMPTY: directory not empty`)
      mockFs.rm.mockRejectedValue(err)

      try {
        await adapter.promises.rmdir(`/notempty`)
        expect.fail(`should have thrown`)
      } catch (e: any) {
        expect(e.code).toBe(`ENOTEMPTY`)
      }
    })

    it(`should set .code = EISDIR on errors with EISDIR in message`, async () => {
      const err = new Error(`EISDIR: illegal operation on a directory`)
      mockFs.rm.mockRejectedValue(err)

      try {
        await adapter.promises.unlink(`/dir`)
        expect.fail(`should have thrown`)
      } catch (e: any) {
        expect(e.code).toBe(`EISDIR`)
      }
    })

    it(`should set .code = EEXIST on errors with EEXIST in message`, async () => {
      const err = new Error(`EEXIST: file already exists`)
      mockFs.mkdir.mockRejectedValue(err)

      try {
        await adapter.promises.mkdir(`/existing`)
        expect.fail(`should have thrown`)
      } catch (e: any) {
        expect(e.code).toBe(`EEXIST`)
      }
    })

    it(`should NOT misclassify ENOTEMPTY as ENOENT`, async () => {
      const err = new Error(`ENOTEMPTY: directory not empty, rmdir '/foo'`)
      mockFs.rm.mockRejectedValue(err)

      try {
        await adapter.promises.rmdir(`/foo`)
        expect.fail(`should have thrown`)
      } catch (e: any) {
        expect(e.code).toBe(`ENOTEMPTY`)
        expect(e.code).not.toBe(`ENOENT`)
      }
    })
  })
})
