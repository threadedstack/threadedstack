import type { TFileTreeChangedMessage } from '@tdsk/domain'

import { loadDirectory } from '@TTH/actions/editor/loadDirectory'
import {
  parentDir,
  closeRelatedTabs,
  cleanFolderState,
} from '@TTH/actions/editor/editorCleanup'
import {
  getFileTreeRoot,
  getFileTreeData,
  getFileContentCache,
  setFileContentCache,
  getActiveSession,
  getOpenSessions,
} from '@TTH/state/accessors'

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let pendingDirs = new Set<string>()

const flushPendingRefreshes = () => {
  const dirs = pendingDirs
  pendingDirs = new Set()
  debounceTimer = null

  for (const dir of dirs) {
    loadDirectory(dir).catch((err) => {
      console.warn(`[FileTreeSync] Failed to refresh directory:`, dir, err)
    })
  }
}

export const clearFileTreeSyncTimers = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  pendingDirs = new Set()
}

export const handleFileTreeChanged = (msg: TFileTreeChangedMessage) => {
  const sessionId = getActiveSession()
  if (!sessionId) return

  const session = getOpenSessions().get(sessionId)
  if (!session) return
  if (session.sandboxId !== msg.sandboxId) return
  if (session.instanceId !== msg.instanceId) return

  const root = getFileTreeRoot()
  if (!root) return

  if (msg.changeType === `delete`) {
    if (msg.entryType === `folder`) cleanFolderState(msg.path)
    closeRelatedTabs(msg.path, msg.entryType === `folder`)
  }

  if (msg.changeType === `write`) {
    const cache = new Map(getFileContentCache())
    const existing = cache.get(msg.path)
    if (existing && (existing.status === `loaded` || existing.status === `dirty`)) {
      cache.set(msg.path, { ...existing, externallyModified: true })
      setFileContentCache(cache)
    }
    return
  }

  const affectedDir = parentDir(msg.path)
  const data = getFileTreeData()
  if (data.has(affectedDir)) {
    pendingDirs.add(affectedDir)
    if (!debounceTimer) {
      debounceTimer = setTimeout(flushPendingRefreshes, 300)
    }
  }
}
