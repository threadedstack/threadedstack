import type { TShimDefinition } from '@TSB/types'

export const fsShim: TShimDefinition = {
  names: [`fs`, `node:fs`],

  source: `
    export const readFile = globalThis._fsReadFile
    export const writeFile = globalThis._fsWriteFile
    export const exists = globalThis._fsExists
    export const mkdir = globalThis._fsMkdir
    export const readdir = globalThis._fsReaddir
    export const unlink = globalThis._fsUnlink
    export const stat = globalThis._fsStat
    export default {
      readFile, writeFile, exists,
      mkdir, readdir, unlink, stat,
    }
  `,

  setupCallbacks: async (jail, ivm, deps) => {
    await jail.set(
      `_fsReadFile`,
      new ivm.Callback(
        async (path: string) => {
          return await deps.fs.readFile(path, { encoding: `utf-8` })
        },
        { async: true }
      )
    )

    await jail.set(
      `_fsWriteFile`,
      new ivm.Callback(
        async (path: string, content: string) => {
          await deps.fs.writeFile(path, content)
        },
        { async: true }
      )
    )

    await jail.set(
      `_fsExists`,
      new ivm.Callback(
        async (path: string) => {
          try {
            await deps.fs.stat(path)
            return true
          } catch {
            return false
          }
        },
        { async: true }
      )
    )

    await jail.set(
      `_fsMkdir`,
      new ivm.Callback(
        async (path: string) => {
          await deps.fs.mkdir(path, { recursive: true })
        },
        { async: true }
      )
    )

    await jail.set(
      `_fsReaddir`,
      new ivm.Callback(
        async (path: string) => {
          return await deps.fs.readdir(path)
        },
        { async: true }
      )
    )

    await jail.set(
      `_fsUnlink`,
      new ivm.Callback(
        async (path: string) => {
          await deps.fs.rm(path)
        },
        { async: true }
      )
    )

    await jail.set(
      `_fsStat`,
      new ivm.Callback(
        async (path: string) => {
          const stat = await deps.fs.stat(path)
          return {
            isDirectory: stat.isDirectory,
            isFile: stat.isFile,
            size: stat.size || 0,
          }
        },
        { async: true }
      )
    )
  },
}
