import type { TMonEditorCB } from '@TSC/types'

import Box from '@mui/material/Box'
import { useRef, useCallback } from 'react'
import { EditorTabs } from '@TTH/components/Editor/EditorTabs'
import { detectLanguage } from '@TTH/utils/editor/detectLanguage'
import { markFileDirty } from '@TTH/actions/editor/markFileDirty'
import { EditorContent } from '@TTH/components/Editor/EditorContent'
import { saveFileContent } from '@TTH/actions/editor/saveFileContent'
import { EditorStatusBar } from '@TTH/components/Editor/EditorStatusBar'
import { updateCursorPosition } from '@TTH/actions/editor/updateCursorPosition'
import {
  useSavingFiles,
  useCursorPosition,
  useFileContentCache,
} from '@TTH/state/selectors'

export type TEditorPane = {
  files: string[]
  onCloseAll: () => void
  activeFile: string | null
  onSelectFile: (path: string) => void
  onCloseFile: (path: string) => void
}

export const EditorPane = (props: TEditorPane) => {
  const { files, onCloseAll, activeFile, onCloseFile, onSelectFile } = props

  const [savingFiles] = useSavingFiles()
  const [cursorPos] = useCursorPosition()
  const [contentCache] = useFileContentCache()

  const activeFileRef = useRef(activeFile)
  activeFileRef.current = activeFile

  const cached = activeFile ? contentCache.get(activeFile) : undefined
  const language = activeFile ? detectLanguage(activeFile) : `plaintext`
  const isSaving = activeFile ? savingFiles.has(activeFile) : false

  const onMount: TMonEditorCB = useCallback((editor, monaco) => {
    editor.onDidChangeCursorPosition((e) => {
      updateCursorPosition({
        lineNumber: e.position.lineNumber,
        column: e.position.column,
      })
    })
    editor.addAction({
      id: `tdsk-save-file`,
      label: `Save File`,
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => {
        const file = activeFileRef.current
        if (file) saveFileContent(file)
      },
    })
  }, [])

  const onChange = useCallback((value: string | undefined) => {
    const file = activeFileRef.current
    file && value !== undefined && markFileDirty(file, value)
  }, [])

  return (
    <Box
      sx={{
        flex: 1,
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
        contentCache={contentCache}
      />

      <Box sx={{ flex: 1, minHeight: 0, overflow: `hidden` }}>
        <EditorContent
          cached={cached}
          onMount={onMount}
          onChange={onChange}
          language={language}
          activeFile={activeFile}
        />
      </Box>

      <EditorStatusBar
        language={language}
        isSaving={isSaving}
        filePath={activeFile}
        cursorPosition={cursorPos}
        isDirty={cached?.status === `dirty`}
      />
    </Box>
  )
}
