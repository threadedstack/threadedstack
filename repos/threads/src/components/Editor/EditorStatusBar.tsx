import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { MonoFont } from '@TTH/constants/values'

export type TEditorStatusBar = {
  filePath: string | null
  language: string
}

export const EditorStatusBar = (props: TEditorStatusBar) => {
  const { filePath, language } = props

  if (!filePath) return null

  return (
    <Box
      sx={{
        height: 22,
        minHeight: 22,
        display: `flex`,
        alignItems: `center`,
        gap: `14px`,
        px: 1.5,
        bgcolor: `background.default`,
        borderTop: 1,
        borderColor: `divider`,
      }}
    >
      <StatusItem>{filePath}</StatusItem>
      <StatusItem>Ln 12, Col 18</StatusItem>
      <StatusItem>UTF-8</StatusItem>
      <StatusItem>LF</StatusItem>
      <StatusItem>{language}</StatusItem>
    </Box>
  )
}

const StatusItem = ({ children }: { children: React.ReactNode }) => (
  <Typography
    noWrap
    sx={{
      fontSize: 10.5,
      fontFamily: MonoFont,
      color: `text.secondary`,
      lineHeight: 1,
    }}
  >
    {children}
  </Typography>
)
