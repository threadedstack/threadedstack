import type { TApiRes } from '@TTH/types'
import type { TFileCtx, TFileEntry } from '@TTH/types'
import type { TSandboxResult, TFileChangeRequest } from '@tdsk/domain'

import { EFileOp } from '@tdsk/domain'
import { sandboxApi } from '@TTH/services/sandboxApi'

const runFileOp = (ctx: TFileCtx, fileChange: TFileChangeRequest) =>
  sandboxApi.fileOp(ctx.orgId, ctx.projectId, ctx.sandboxId, {
    fileChange,
    instanceId: ctx.instanceId,
  })

const assertExecOk = (resp: TApiRes<TSandboxResult>, label: string, path: string) => {
  if (resp.error) {
    const msg = resp.error.message || label
    console.warn(`[FileService] ${label} failed for ${path}:`, msg)
    throw new Error(msg)
  }
  if (!resp.data) throw new Error(`No response from ${label} for ${path}`)
  if (resp.data.exitCode !== 0) {
    const msg = resp.data.error || `${label} failed (exit ${resp.data.exitCode})`
    console.warn(`[FileService] ${label} non-zero exit for ${path}:`, msg)
    throw new Error(msg)
  }
  return resp.data
}

class FileService {
  async listDir(ctx: TFileCtx, dirPath: string): Promise<TFileEntry[]> {
    const resp = await runFileOp(ctx, { op: EFileOp.list, path: dirPath })
    const data = assertExecOk(resp, `listDir`, dirPath)

    const lines = data.output.split(`\n`).filter(Boolean)
    const entries: TFileEntry[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed === `.` || trimmed === `..` || trimmed === `./` || trimmed === `../`)
        continue

      const isFolder = trimmed.endsWith(`/`)
      const name = isFolder ? trimmed.slice(0, -1) : trimmed.replace(/[*@=|]$/, ``)
      if (!name) continue
      const path = dirPath.endsWith(`/`) ? `${dirPath}${name}` : `${dirPath}/${name}`

      entries.push({ name, path, type: isFolder ? `folder` : `file` })
    }

    return entries
  }

  async readFile(ctx: TFileCtx, filePath: string): Promise<string> {
    const resp = await runFileOp(ctx, { op: EFileOp.read, path: filePath })
    const data = assertExecOk(resp, `readFile`, filePath)
    return data.output ?? ``
  }

  async writeFile(ctx: TFileCtx, filePath: string, content: string): Promise<void> {
    const resp = await runFileOp(ctx, { op: EFileOp.write, path: filePath, content })
    assertExecOk(resp, `writeFile`, filePath)
  }

  async fileExists(ctx: TFileCtx, filePath: string): Promise<boolean> {
    const resp = await runFileOp(ctx, { op: EFileOp.exists, path: filePath })
    if (resp.error) {
      const msg = resp.error.message || `Failed to check file existence`
      console.warn(`[FileService] fileExists failed for ${filePath}:`, msg)
      throw new Error(msg)
    }
    if (!resp.data) throw new Error(`No response from fileExists for ${filePath}`)
    if (resp.data.exitCode === 0) return true
    if (resp.data.exitCode === 1) return false
    const msg = resp.data.error || `fileExists failed (exit ${resp.data.exitCode})`
    console.warn(`[FileService] fileExists error for ${filePath}:`, msg)
    throw new Error(msg)
  }

  async createFile(ctx: TFileCtx, filePath: string): Promise<void> {
    const resp = await runFileOp(ctx, {
      op: EFileOp.create,
      path: filePath,
      entryType: `file`,
    })
    assertExecOk(resp, `createFile`, filePath)
  }

  async createFolder(ctx: TFileCtx, dirPath: string): Promise<void> {
    const resp = await runFileOp(ctx, {
      op: EFileOp.create,
      path: dirPath,
      entryType: `folder`,
    })
    assertExecOk(resp, `createFolder`, dirPath)
  }

  async deleteFile(ctx: TFileCtx, filePath: string): Promise<void> {
    const resp = await runFileOp(ctx, {
      op: EFileOp.delete,
      path: filePath,
      entryType: `file`,
    })
    assertExecOk(resp, `deleteFile`, filePath)
  }

  async deleteFolder(ctx: TFileCtx, dirPath: string): Promise<void> {
    const resp = await runFileOp(ctx, {
      op: EFileOp.delete,
      path: dirPath,
      entryType: `folder`,
    })
    assertExecOk(resp, `deleteFolder`, dirPath)
  }

  async fileSize(ctx: TFileCtx, filePath: string): Promise<number> {
    const resp = await runFileOp(ctx, { op: EFileOp.size, path: filePath })
    const data = assertExecOk(resp, `fileSize`, filePath)
    const match = data.output?.trim().match(/^(\d+)/)
    if (!match)
      throw new Error(`Could not parse file size from: "${data.output?.trim()}"`)
    return Number.parseInt(match[1], 10)
  }
}

export const fileService = new FileService()
