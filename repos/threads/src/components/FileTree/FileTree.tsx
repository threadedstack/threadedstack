import { mockFiles } from './mockFiles'
import { useState, useMemo } from 'react'
import { FileTreeItem } from './FileTreeItem'
import { InputAdornment, IconButton } from '@mui/material'
import { Add, Refresh, Search } from '@mui/icons-material'
import {
  FileTreeList,
  FileTreeHeader,
  FileTreeSearch,
  FileTreeContainer,
  FileTreeHeaderLabel,
} from './FileTree.styles'

export type TFileTree = {
  hidden: boolean
  openFiles: string[]
  activeFile: string | null
  onOpen: (path: string) => void
}

export const FileTree = (props: TFileTree) => {
  const { hidden, onOpen, activeFile, openFiles } = props
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query) return mockFiles
    const lower = query.toLowerCase()
    return mockFiles.filter((f) => f.path.toLowerCase().includes(lower))
  }, [query])

  const openSet = useMemo(() => new Set(openFiles), [openFiles])

  return (
    <FileTreeContainer hidden={hidden}>
      <FileTreeHeader>
        <FileTreeHeaderLabel>Files</FileTreeHeaderLabel>
        <IconButton
          size='small'
          disabled
          title='Coming soon'
        >
          <Add sx={{ fontSize: 18 }} />
        </IconButton>
        <IconButton
          size='small'
          disabled
          title='Coming soon'
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
            <Search sx={{ fontSize: 16, color: 'text.disabled' }} />
          </InputAdornment>
        }
      />
      <FileTreeList>
        {filtered.map((file) => (
          <FileTreeItem
            file={file}
            onOpen={onOpen}
            key={file.path}
            active={activeFile === file.path}
            isOpen={openSet.has(file.path)}
          />
        ))}
      </FileTreeList>
    </FileTreeContainer>
  )
}
