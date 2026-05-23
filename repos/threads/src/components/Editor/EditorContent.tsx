import type { TMonEditorCB } from '@TSC/types'
import type { TFileCacheEntry } from '@TTH/types'

import Box from '@mui/material/Box'
import { Monaco, Loading } from '@tdsk/components'
import { MonacoOptions } from '@TTH/constants/monaco'

export type TEditorContent = {
  language: string
  onMount: TMonEditorCB
  cached?: TFileCacheEntry
  activeFile: string | null
  onChange: (value: string | undefined) => void
}

export const EditorContent = (props: TEditorContent) => {
  const { cached, onMount, onChange, language, activeFile } = props

  if (cached?.status === `loading`)
    return (
      <Loading
        message='Loading file...'
        messageSx={{ color: `text.primary` }}
      />
    )

  if (cached?.status === `error`)
    return (
      <Box
        sx={{
          p: 3,
          display: `flex`,
          alignItems: `center`,
          justifyContent: `center`,
          height: `100%`,
          color: `error.main`,
        }}
      >
        {cached.error}
      </Box>
    )

  const content =
    cached?.status === `loaded` || cached?.status === `dirty` ? cached.content : ``

  return (
    <Monaco
      hideActions
      variant='ide'
      value={content}
      language={language}
      onMount={onMount}
      onChange={onChange}
      themeDark='r-dark'
      themeLight='r-light'
      options={MonacoOptions}
      path={activeFile ?? undefined}
    />
  )
}
