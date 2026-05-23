export type TFileEntry = {
  name: string
  path: string
  type: `file` | `folder`
}

export type TFileCacheEntry =
  | { status: `loading` }
  | { status: `error`; error: string }
  | { status: `dirty`; content: string; externallyModified?: boolean }
  | { status: `loaded`; content: string; externallyModified?: boolean }

export type TCursorPosition = {
  lineNumber: number
  column: number
}

export type TFileCtx = {
  orgId: string
  projectId: string
  sandboxId: string
  instanceId: string
}

export type TFileTreeAction =
  | { type: `create-file`; parentPath: string }
  | { type: `create-folder`; parentPath: string }
  | { type: `confirm-delete`; entry: TFileEntry }

export type TFileTreeCreateType = Extract<TFileTreeAction, { parentPath: string }>['type']
