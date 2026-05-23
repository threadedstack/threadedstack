import type { TFileTreeCreateType } from '@TTH/types'

import { NoteAdd, CreateNewFolder } from '@mui/icons-material'
import { useState, useRef, useEffect, useCallback } from 'react'
import { FileTreeRow, InlineNameInput } from '@TTH/components/FileTree/FileTree.styles'

type TFileTreeInlineInput = {
  type: TFileTreeCreateType
  depth: number
  onSubmit: (name: string) => void
  onCancel: () => void
}

const iconSx = { fontSize: 16, color: `text.secondary`, flexShrink: 0 }

export const FileTreeInlineInput = (props: TFileTreeInlineInput) => {
  const { type, depth, onCancel, onSubmit: onSubmitCB } = props

  const submitted = useRef(false)
  const [value, setValue] = useState(``)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [])

  const onSubmit = useCallback(() => {
    if (submitted.current) return
    const trimmed = value.trim()
    if (trimmed) {
      submitted.current = true
      onSubmitCB(trimmed)
    } else {
      onCancel()
    }
  }, [value, onSubmitCB, onCancel])

  return (
    <FileTreeRow
      depth={depth}
      sx={{ cursor: `default` }}
    >
      {type === `create-folder` ? (
        <CreateNewFolder sx={iconSx} />
      ) : (
        <NoteAdd sx={iconSx} />
      )}
      <InlineNameInput
        value={value}
        inputRef={inputRef}
        placeholder={type === `create-folder` ? `folder name` : `file name`}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === `Enter`) onSubmit()
          if (e.key === `Escape`) onCancel()
        }}
        onBlur={onSubmit}
      />
    </FileTreeRow>
  )
}
