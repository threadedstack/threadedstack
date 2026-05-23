import {
  resetOpenEditorFiles,
  resetActiveEditorFile,
  resetFileTreeData,
  resetExpandedFolders,
  resetLoadingFolders,
  resetFileContentCache,
  resetCursorPosition,
  resetFileTreeRoot,
  resetSavingFiles,
  resetFileTreeAction,
} from '@TTH/state/accessors'

export const resetEditor = () => {
  resetOpenEditorFiles()
  resetActiveEditorFile()
  resetFileTreeData()
  resetExpandedFolders()
  resetLoadingFolders()
  resetFileContentCache()
  resetCursorPosition()
  resetFileTreeRoot()
  resetSavingFiles()
  resetFileTreeAction()
}
