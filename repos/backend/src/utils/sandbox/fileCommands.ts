import type { TFileChangeRequest, TFileOpType, TMutatingFileOp } from '@tdsk/domain'

import { EFileOp, Exception } from '@tdsk/domain'

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

const MutatingOps = new Set<TFileOpType>([EFileOp.create, EFileOp.delete, EFileOp.write])

const ValidOps = new Set<TFileOpType>([
  EFileOp.list,
  EFileOp.read,
  EFileOp.size,
  EFileOp.write,
  EFileOp.create,
  EFileOp.delete,
  EFileOp.exists,
])

export const isMutatingOp = (op: TFileOpType): op is TMutatingFileOp =>
  MutatingOps.has(op)

export function validateFileChange(
  fc: Record<string, unknown>
): asserts fc is TFileChangeRequest {
  if (!fc || typeof fc !== `object`) throw new Exception(400, `fileChange is required`)

  const op = fc.op as EFileOp
  if (!op || !ValidOps.has(op as TFileOpType))
    throw new Exception(400, `fileChange.op must be one of: ${[...ValidOps].join(`, `)}`)

  if (!fc.path || typeof fc.path !== `string`)
    throw new Exception(400, `fileChange.path is required and must be a string`)

  if (fc.path.includes(`\0`))
    throw new Exception(400, `fileChange.path contains invalid characters`)

  if (fc.path.includes(`..`)) throw new Exception(400, `path traversal not allowed`)

  if (
    (op === EFileOp.create || op === EFileOp.delete) &&
    fc.entryType !== `file` &&
    fc.entryType !== `folder`
  )
    throw new Exception(
      400,
      `fileChange.entryType must be 'file' or 'folder' for ${op} operations`
    )

  if (op === EFileOp.write) {
    if (fc.content === undefined || fc.content === null || typeof fc.content !== `string`)
      throw new Exception(400, `fileChange.content is required for write operations`)
    if (fc.content.length > 2 * 1024 * 1024)
      throw new Exception(400, `fileChange.content exceeds maximum size (2MB)`)
  }
}

export const buildFileCommand = (
  fc: TFileChangeRequest
): { command: string; args: string[] } => {
  const path = shellQuote(fc.path)

  switch (fc.op) {
    case EFileOp.list:
      return { command: `ls`, args: [`-1aF`, `--`, path] }
    case EFileOp.read:
      return { command: `cat`, args: [`--`, path] }
    case EFileOp.write: {
      const encoded = Buffer.from(fc.content, `utf-8`).toString(`base64`)
      return { command: `printf`, args: [`%s`, encoded, `|`, `base64`, `-d`, `>`, path] }
    }
    case EFileOp.create:
      return fc.entryType === `folder`
        ? { command: `mkdir`, args: [`-p`, `--`, path] }
        : { command: `touch`, args: [`--`, path] }
    case EFileOp.delete:
      return fc.entryType === `folder`
        ? { command: `rm`, args: [`-rf`, `--`, path] }
        : { command: `rm`, args: [`-f`, `--`, path] }
    case EFileOp.exists:
      return { command: `test`, args: [`-e`, path] }
    case EFileOp.size:
      return { command: `wc`, args: [`-c`, `--`, path] }
  }
}
