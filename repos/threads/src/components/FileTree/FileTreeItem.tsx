import type { TFileEntry, TFileTreeAction } from '@TTH/types'

import { useCallback } from 'react'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import {
  FileTreeRow,
  OpenFileDot,
  FileTreeFileName,
  FileTreeRowActions,
} from '@TTH/components/FileTree/FileTree.styles'
import {
  Code,
  Folder,
  Delete,
  NoteAdd,
  FolderOpen,
  DataObject,
  ExpandMore,
  Description,
  ChevronRight,
  CreateNewFolder,
} from '@mui/icons-material'

const iconSx = { fontSize: 16, color: `text.secondary`, flexShrink: 0 }

const FileIcon = ({ name }: { name: string }) => {
  if (name.endsWith(`.json`)) return <DataObject sx={iconSx} />
  if (name.endsWith(`.md`) || name.endsWith(`.mdx`)) return <Description sx={iconSx} />
  return <Code sx={iconSx} />
}

const FolderChevron = ({
  isLoading,
  isExpanded,
}: {
  isLoading: boolean
  isExpanded: boolean
}) => {
  if (isLoading)
    return (
      <CircularProgress
        size={14}
        sx={{ flexShrink: 0, color: `text.secondary` }}
      />
    )
  if (isExpanded) return <ExpandMore sx={iconSx} />
  return <ChevronRight sx={iconSx} />
}

const FolderIcon = ({ isExpanded }: { isExpanded: boolean }) =>
  isExpanded ? <FolderOpen sx={iconSx} /> : <Folder sx={iconSx} />

type TFileTreeItem = {
  depth: number
  active: boolean
  isOpen: boolean
  entry: TFileEntry
  isLoading: boolean
  isExpanded: boolean
  onOpen: (path: string) => void
  onToggle: (path: string) => void
  onAction: (action: TFileTreeAction) => void
  onContextMenu: (e: React.MouseEvent, entry: TFileEntry) => void
}

const actionBtnSx = { p: 0.25 }
const actionIconSx = { fontSize: 14 }

export const FileTreeItem = (props: TFileTreeItem) => {
  const {
    entry,
    depth,
    onOpen,
    active,
    isOpen,
    onToggle,
    onAction,
    isLoading,
    isExpanded,
    onContextMenu,
  } = props
  const isFolder = entry.type === `folder`

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => onContextMenu(e, entry),
    [entry, onContextMenu]
  )

  const stopAndAction = useCallback(
    (e: React.MouseEvent, action: TFileTreeAction) => {
      e.stopPropagation()
      onAction(action)
    },
    [onAction]
  )

  return (
    <FileTreeRow
      active={active}
      depth={depth}
      onClick={isFolder ? () => onToggle(entry.path) : () => onOpen(entry.path)}
      onContextMenu={handleContextMenu}
    >
      {isFolder && (
        <FolderChevron
          isLoading={isLoading}
          isExpanded={isExpanded}
        />
      )}
      {isFolder ? <FolderIcon isExpanded={isExpanded} /> : <FileIcon name={entry.name} />}
      <FileTreeFileName sx={{ color: active ? `primary.main` : `text.primary` }}>
        {entry.name}
      </FileTreeFileName>
      {isOpen && !active && <OpenFileDot />}
      <FileTreeRowActions>
        {isFolder && (
          <>
            <IconButton
              size='small'
              sx={actionBtnSx}
              title='New File'
              onClick={(e) =>
                stopAndAction(e, { type: `create-file`, parentPath: entry.path })
              }
            >
              <NoteAdd sx={actionIconSx} />
            </IconButton>
            <IconButton
              size='small'
              sx={actionBtnSx}
              title='New Folder'
              onClick={(e) =>
                stopAndAction(e, { type: `create-folder`, parentPath: entry.path })
              }
            >
              <CreateNewFolder sx={actionIconSx} />
            </IconButton>
          </>
        )}
        <IconButton
          size='small'
          sx={actionBtnSx}
          title='Delete'
          onClick={(e) => stopAndAction(e, { type: `confirm-delete`, entry })}
        >
          <Delete sx={{ ...actionIconSx, color: `error.main` }} />
        </IconButton>
      </FileTreeRowActions>
    </FileTreeRow>
  )
}
