import type { IFileSystem, FsStat } from 'just-bash'

const POSIX_CODES = [`ENOTEMPTY`, `ENOTDIR`, `EISDIR`, `EEXIST`, `ENOENT`]

/**
 * InMemoryFs errors include POSIX codes in messages but don't set `.code`.
 * isomorphic-git checks `err.code === 'ENOENT'`, so we must set it.
 */
const fixErrorCode = (err: any) => {
  if (err.code) return
  const msg = err.message || ``
  for (const code of POSIX_CODES) {
    if (msg.includes(code)) {
      err.code = code
      return
    }
  }
}

const withFixedErrors = <T extends (...args: any[]) => Promise<any>>(fn: T): T =>
  (async (...args: any[]) => {
    try {
      return await fn(...args)
    } catch (err: any) {
      fixErrorCode(err)
      throw err
    }
  }) as unknown as T

/**
 * Wraps a just-bash FsStat into the shape isomorphic-git expects.
 * isomorphic-git needs isFile/isDirectory/isSymbolicLink as methods, not booleans.
 *
 * ino uses mtimeMs so isomorphic-git's compareStats detects sub-second changes.
 * Without this, two writes in the same second with the same file size would
 * appear identical (mtimeSeconds matches, size matches) and skip re-hashing.
 */
const wrapStat = (stat: FsStat) => ({
  isFile: () => stat.isFile,
  isDirectory: () => stat.isDirectory,
  isSymbolicLink: () => stat.isSymbolicLink,
  mode: stat.mode,
  size: stat.size,
  mtime: stat.mtime,
  mtimeMs: stat.mtime.getTime(),
  ctimeMs: stat.mtime.getTime(),
  uid: 1,
  gid: 1,
  dev: 1,
  ino: stat.mtime.getTime(),
})

/**
 * Bridges just-bash IFileSystem to the promise-based FS interface
 * that isomorphic-git expects (PromiseFsClient shape).
 */
export const createGitFsAdapter = (fs: IFileSystem) => ({
  promises: {
    readFile: async (path: string, options?: { encoding?: string } | string) => {
      try {
        const encoding = typeof options === `string` ? options : options?.encoding
        if (encoding) return await fs.readFile(path, { encoding: encoding as `utf-8` })
        return await fs.readFileBuffer(path)
      } catch (err: any) {
        fixErrorCode(err)
        throw err
      }
    },
    writeFile: withFixedErrors(async (path: string, content: string | Uint8Array) => {
      await fs.writeFile(path, content)
    }),
    mkdir: withFixedErrors(async (path: string, _mode?: number | { mode?: number }) => {
      await fs.mkdir(path, { recursive: true })
    }),
    rmdir: withFixedErrors(async (path: string) => {
      await fs.rm(path)
    }),
    unlink: withFixedErrors(async (path: string) => {
      await fs.rm(path)
    }),
    stat: withFixedErrors(async (path: string) => wrapStat(await fs.stat(path))),
    lstat: withFixedErrors(async (path: string) => wrapStat(await fs.lstat(path))),
    readdir: withFixedErrors(async (path: string) => await fs.readdir(path)),
    readlink: withFixedErrors(async (path: string) => await fs.readlink(path)),
    symlink: withFixedErrors(async (target: string, linkPath: string) => {
      await fs.symlink(target, linkPath)
    }),
  },
})
