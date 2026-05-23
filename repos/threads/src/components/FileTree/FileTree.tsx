import type { TFileEntry, TFileTreeAction } from '@TTH/types'

import { useState, useMemo, useCallback } from 'react'
import { InputAdornment, IconButton } from '@mui/material'
import { createEntry } from '@TTH/actions/editor/createEntry'
import { deleteEntry } from '@TTH/actions/editor/deleteEntry'
import { toggleFolder } from '@TTH/actions/editor/toggleFolder'
import { FileTreeItem } from '@TTH/components/FileTree/FileTreeItem'
import { refreshFileTree } from '@TTH/actions/editor/refreshFileTree'
import { Refresh, Search, NoteAdd, CreateNewFolder } from '@mui/icons-material'
import { FileTreeInlineInput } from '@TTH/components/FileTree/FileTreeInlineInput'
import { FileTreeContextMenu } from '@TTH/components/FileTree/FileTreeContextMenu'
import { FileTreeDeleteDialog } from '@TTH/components/FileTree/FileTreeDeleteDialog'
import {
  startFileTreeAction,
  cancelFileTreeAction,
} from '@TTH/actions/editor/fileTreeAction'
import {
  useFileTreeData,
  useFileTreeRoot,
  useFileTreeAction,
  useLoadingFolders,
  useExpandedFolders,
} from '@TTH/state/selectors'
import {
  FileTreeList,
  FileTreeHeader,
  FileTreeSearch,
  FileTreeContainer,
  FileTreeHeaderLabel,
} from './FileTree.styles'

type TFileTree = {
  hidden: boolean
  openFiles: string[]
  activeFile: string | null
  onOpen: (path: string) => void
}

const collectVisibleEntries = (
  root: string,
  data: Map<string, TFileEntry[]>,
  expanded: Set<string>
): TFileEntry[] => {
  const entries = data.get(root)
  if (!entries) return []

  const result: TFileEntry[] = []
  for (const entry of entries) {
    result.push(entry)
    if (entry.type === `folder` && expanded.has(entry.path)) {
      result.push(...collectVisibleEntries(entry.path, data, expanded))
    }
  }
  return result
}

const depthFromRoot = (path: string, root: string): number => {
  if (!root) return 0
  const rootParts = root.replace(/\/$/, ``).split(`/`).length
  const pathParts = path.split(`/`).length
  return pathParts - rootParts
}

type TContextMenuState = {
  entry: TFileEntry | null
  position: { top: number; left: number } | null
}

const defContextMenu: TContextMenuState = { entry: null, position: null }

export const FileTree = (props: TFileTree) => {
  const { hidden, onOpen, openFiles, activeFile } = props

  const [query, setQuery] = useState(``)
  const [fileTreeData] = useFileTreeData()
  const [fileTreeRoot] = useFileTreeRoot()
  const [loadingFolders] = useLoadingFolders()
  const [fileTreeAction] = useFileTreeAction()
  const [expandedFolders] = useExpandedFolders()
  const [ctxMenu, setCtxMenu] = useState<TContextMenuState>(defContextMenu)

  const visibleEntries = useMemo(
    () => collectVisibleEntries(fileTreeRoot, fileTreeData, expandedFolders),
    [fileTreeRoot, fileTreeData, expandedFolders]
  )

  const filtered = useMemo(() => {
    if (!query) return visibleEntries
    const lower = query.toLowerCase()
    return visibleEntries.filter((f) => f.name.toLowerCase().includes(lower))
  }, [query, visibleEntries])

  const openSet = useMemo(() => new Set(openFiles), [openFiles])

  const onContextMenu = useCallback((e: React.MouseEvent, entry: TFileEntry) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ entry, position: { top: e.clientY, left: e.clientX } })
  }, [])

  const onCloseCtxMenu = useCallback(() => setCtxMenu(defContextMenu), [])

  const onAction = useCallback((action: TFileTreeAction) => {
    if (action.type !== `confirm-delete`) setQuery(``)
    startFileTreeAction(action)
  }, [])

  const onCancelAction = useCallback(() => cancelFileTreeAction(), [])

  const onCreate = useCallback(
    (name: string) => {
      if (!fileTreeAction) return
      if (fileTreeAction.type === `create-file`)
        createEntry(`file`, fileTreeAction.parentPath, name)
      else if (fileTreeAction.type === `create-folder`)
        createEntry(`folder`, fileTreeAction.parentPath, name)
    },
    [fileTreeAction]
  )

  const onConfirmDelete = useCallback(() => {
    fileTreeAction?.type === `confirm-delete` && deleteEntry(fileTreeAction.entry)
  }, [fileTreeAction])

  const onNewFileAtRoot = useCallback(() => {
    fileTreeRoot && onAction({ type: `create-file`, parentPath: fileTreeRoot })
  }, [fileTreeRoot, onAction])

  const onNewFolderAtRoot = useCallback(() => {
    fileTreeRoot && onAction({ type: `create-folder`, parentPath: fileTreeRoot })
  }, [fileTreeRoot, onAction])

  const deleteDialogEntry =
    fileTreeAction?.type === `confirm-delete` ? fileTreeAction.entry : null

  const inlineAction =
    fileTreeAction?.type === `create-file` || fileTreeAction?.type === `create-folder`
      ? fileTreeAction
      : null

  return (
    <FileTreeContainer hidden={hidden}>
      <FileTreeHeader>
        <FileTreeHeaderLabel>Files</FileTreeHeaderLabel>
        <IconButton
          size='small'
          title='New File'
          disabled={!fileTreeRoot}
          onClick={onNewFileAtRoot}
        >
          <NoteAdd sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton
          size='small'
          title='New Folder'
          disabled={!fileTreeRoot}
          onClick={onNewFolderAtRoot}
        >
          <CreateNewFolder sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton
          size='small'
          title='Refresh'
          onClick={refreshFileTree}
        >
          <Refresh sx={{ fontSize: 18 }} />
        </IconButton>
      </FileTreeHeader>
      <FileTreeSearch
        fullWidth
        value={query}
        placeholder='filter files'
        onChange={(e) => setQuery(e.target.value)}
        startAdornment={
          <InputAdornment position='start'>
            <Search sx={{ fontSize: 16, color: `text.disabled` }} />
          </InputAdornment>
        }
      />
      <FileTreeList>
        {!fileTreeRoot ? (
          <EmptyState />
        ) : (
          <>
            {inlineAction && inlineAction.parentPath === fileTreeRoot && (
              <FileTreeInlineInput
                depth={0}
                onSubmit={onCreate}
                type={inlineAction.type}
                onCancel={onCancelAction}
              />
            )}
            {filtered.map((entry) => {
              const depth = depthFromRoot(entry.path, fileTreeRoot)
              const isFolder = entry.type === `folder`
              const isExpanded = expandedFolders.has(entry.path)
              const showInline =
                isFolder &&
                isExpanded &&
                inlineAction &&
                inlineAction.parentPath === entry.path

              return (
                <div key={entry.path}>
                  <FileTreeItem
                    entry={entry}
                    depth={depth}
                    onOpen={onOpen}
                    onAction={onAction}
                    onToggle={toggleFolder}
                    isExpanded={isExpanded}
                    onContextMenu={onContextMenu}
                    isOpen={openSet.has(entry.path)}
                    active={activeFile === entry.path}
                    isLoading={loadingFolders.has(entry.path)}
                  />
                  {showInline && (
                    <FileTreeInlineInput
                      depth={depth + 1}
                      onSubmit={onCreate}
                      type={inlineAction.type}
                      onCancel={onCancelAction}
                    />
                  )}
                </div>
              )
            })}
          </>
        )}
      </FileTreeList>

      <FileTreeContextMenu
        entry={ctxMenu.entry}
        anchorPosition={ctxMenu.position}
        onClose={onCloseCtxMenu}
        onAction={onAction}
      />

      <FileTreeDeleteDialog
        entry={deleteDialogEntry}
        onConfirm={onConfirmDelete}
        onCancel={onCancelAction}
      />
    </FileTreeContainer>
  )
}

const EmptyState = () => (
  <FileTreeHeaderLabel
    sx={{
      px: 1.5,
      py: 2,
      fontSize: 12,
      fontWeight: 400,
      textTransform: `none`,
      letterSpacing: `normal`,
    }}
  >
    Connect to view files
  </FileTreeHeaderLabel>
)
