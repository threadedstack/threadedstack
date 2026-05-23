import type { TFileEntry, TFileTreeAction } from '@TTH/types'

import Menu from '@mui/material/Menu'
import Divider from '@mui/material/Divider'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import { NoteAdd, CreateNewFolder, Delete } from '@mui/icons-material'

type TFileTreeContextMenu = {
  entry: TFileEntry | null
  anchorPosition: { top: number; left: number } | null
  onClose: () => void
  onAction: (action: TFileTreeAction) => void
}

const parentOf = (path: string) => {
  const idx = path.lastIndexOf(`/`)
  return idx > 0 ? path.slice(0, idx) : `/`
}

export const FileTreeContextMenu = (props: TFileTreeContextMenu) => {
  const { entry, anchorPosition, onClose, onAction } = props
  const open = Boolean(anchorPosition && entry)
  const isFolder = entry?.type === `folder`
  const parentPath = entry ? (isFolder ? entry.path : parentOf(entry.path)) : `/`

  const act = (action: TFileTreeAction) => {
    onAction(action)
    onClose()
  }

  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference='anchorPosition'
      anchorPosition={anchorPosition ?? undefined}
      slotProps={{
        paper: {
          sx: {
            minWidth: 180,
            py: 0.5,
            [`& .MuiMenuItem-root`]: { fontSize: 13, py: 0.75 },
            [`& .MuiListItemIcon-root`]: { minWidth: 32 },
          },
        },
      }}
    >
      <MenuItem onClick={() => act({ type: `create-file`, parentPath })}>
        <ListItemIcon>
          <NoteAdd fontSize='small' />
        </ListItemIcon>
        <ListItemText>New File</ListItemText>
      </MenuItem>
      <MenuItem onClick={() => act({ type: `create-folder`, parentPath })}>
        <ListItemIcon>
          <CreateNewFolder fontSize='small' />
        </ListItemIcon>
        <ListItemText>New Folder</ListItemText>
      </MenuItem>
      {entry && <Divider sx={{ my: 0.5 }} />}
      {entry && (
        <MenuItem
          onClick={() => act({ type: `confirm-delete`, entry })}
          sx={{ color: `error.main` }}
        >
          <ListItemIcon>
            <Delete
              fontSize='small'
              color='error'
            />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      )}
    </Menu>
  )
}
