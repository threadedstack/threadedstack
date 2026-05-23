import type { TCursorPosition } from '@TTH/types'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { MonoFont } from '@TTH/constants/values'

export type TEditorStatusBar = {
  language: string
  isDirty: boolean
  isSaving: boolean
  filePath: string | null
  cursorPosition: TCursorPosition
}

export const EditorStatusBar = (props: TEditorStatusBar) => {
  const { isDirty, isSaving, filePath, language, cursorPosition } = props

  if (!filePath) return null

  return (
    <Box
      sx={{
        px: 1.5,
        height: 22,
        gap: `14px`,
        borderTop: 1,
        minHeight: 22,
        display: `flex`,
        alignItems: `center`,
        borderColor: `divider`,
        bgcolor: `background.default`,
      }}
    >
      <StatusItem>{filePath}</StatusItem>
      <StatusItem>
        Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}
      </StatusItem>
      <StatusItem>UTF-8</StatusItem>
      <StatusItem>LF</StatusItem>
      <StatusItem>{language}</StatusItem>
      {isSaving && <StatusItem>Saving...</StatusItem>}
      {isDirty && !isSaving && <StatusItem>Modified</StatusItem>}
    </Box>
  )
}

const StatusItem = ({ children }: { children: React.ReactNode }) => (
  <Typography
    noWrap
    sx={{
      lineHeight: 1,
      fontSize: 10.5,
      fontFamily: MonoFont,
      color: `text.secondary`,
    }}
  >
    {children}
  </Typography>
)
