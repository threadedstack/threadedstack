import {
  resetOpenEditorFiles,
  resetActiveEditorFile,
  resetFileContentCache,
  resetCursorPosition,
  resetSavingFiles,
} from '@TTH/state/accessors'

export const closeAllEditorFiles = () => {
  resetOpenEditorFiles()
  resetActiveEditorFile()
  resetFileContentCache()
  resetCursorPosition()
  resetSavingFiles()
}
