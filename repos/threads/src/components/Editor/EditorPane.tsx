import { useMemo } from 'react'
import Box from '@mui/material/Box'
import { EditorTabs } from './EditorTabs'
import { MonoFont } from '@TTH/constants/values'
import { mockFileContents } from './mockContent'
import Typography from '@mui/material/Typography'
import { EditorStatusBar } from './EditorStatusBar'
import { DefaultLines } from '@TTH/constants/monaco'
import { detectLanguage } from '@TTH/utils/editor/detectLanguage'

export type TEditorPane = {
  files: string[]
  onCloseAll: () => void
  activeFile: string | null
  onSelectFile: (path: string) => void
  onCloseFile: (path: string) => void
}

export const EditorPane = (props: TEditorPane) => {
  const { files, onCloseAll, activeFile, onCloseFile, onSelectFile } = props

  const lines = useMemo(() => {
    if (!activeFile) return DefaultLines
    return mockFileContents[activeFile] ?? DefaultLines
  }, [activeFile])

  const language = useMemo(() => {
    return activeFile ? detectLanguage(activeFile) : `Plain Text`
  }, [activeFile])

  return (
    <Box
      sx={{
        minHeight: 0,
        borderBottom: 1,
        display: `flex`,
        overflow: `hidden`,
        borderColor: `divider`,
        flexDirection: `column`,
      }}
    >
      <EditorTabs
        files={files}
        onClose={onCloseFile}
        activeFile={activeFile}
        onSelect={onSelectFile}
        onCloseAll={onCloseAll}
      />

      {/* Code body */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: `auto`,
          bgcolor: `background.paper`,
        }}
      >
        <Box
          sx={{
            display: `grid`,
            minHeight: `100%`,
            gridTemplateColumns: `44px 1fr`,
          }}
        >
          {/* Line number gutter */}
          <Box
            sx={{
              pr: 1,
              py: 0.5,
              borderRight: 1,
              display: `flex`,
              borderColor: `divider`,
              flexDirection: `column`,
              bgcolor: `background.default`,
            }}
          >
            {lines.map((_line, idx) => (
              <Typography
                key={idx}
                sx={{
                  px: 0.5,
                  fontSize: 12.25,
                  lineHeight: 1.65,
                  textAlign: `right`,
                  userSelect: `none`,
                  fontFamily: MonoFont,
                  color: `text.disabled`,
                }}
              >
                {idx + 1}
              </Typography>
            ))}
          </Box>

          {/* Code content */}
          <Box sx={{ py: 0.5, pl: 1.5, pr: 2, minWidth: 0 }}>
            {lines.map((line, idx) => (
              <Typography
                key={idx}
                component='pre'
                sx={{
                  fontSize: 12.25,
                  fontFamily: MonoFont,
                  lineHeight: 1.65,
                  color: `text.primary`,
                  margin: 0,
                  whiteSpace: `pre`,
                  minHeight: `1.65em`,
                }}
              >
                {line || ` `}
              </Typography>
            ))}
          </Box>
        </Box>
      </Box>

      <EditorStatusBar
        filePath={activeFile}
        language={language}
      />
    </Box>
  )
}
