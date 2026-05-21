import type { TMockFile } from './mockFiles'

import {
  Code,
  Folder,
  FolderOpen,
  DataObject,
  Description,
  VisibilityOff,
} from '@mui/icons-material'
import { FileTreeRow, OpenFileDot, FileTreeFileName } from './FileTree.styles'

const iconForFile = (file: TMockFile) => {
  if (file.type === 'folder')
    return file.open ? (
      <FolderOpen sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
    ) : (
      <Folder sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
    )

  switch (file.lang) {
    case 'ts':
      return <Code sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
    case 'json':
      return <DataObject sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
    case 'md':
      return <Description sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
    case 'gi':
      return (
        <VisibilityOff sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
      )
    default:
      return <Code sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
  }
}

const nameFromPath = (path: string) => {
  const parts = path.split('/')
  return parts[parts.length - 1]
}

export type TFileTreeItem = {
  file: TMockFile
  active: boolean
  isOpen: boolean
  onOpen: (path: string) => void
}

export const FileTreeItem = (props: TFileTreeItem) => {
  const { file, active, isOpen, onOpen } = props
  const isFile = file.type === 'file'

  return (
    <FileTreeRow
      active={active}
      depth={file.depth}
      onClick={isFile ? () => onOpen(file.path) : undefined}
      sx={!isFile ? { cursor: 'default' } : undefined}
    >
      {iconForFile(file)}
      <FileTreeFileName sx={{ color: active ? 'primary.main' : 'text.primary' }}>
        {nameFromPath(file.path)}
      </FileTreeFileName>
      {isOpen && !active && <OpenFileDot />}
    </FileTreeRow>
  )
}
