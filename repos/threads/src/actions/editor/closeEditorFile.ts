import {
  getOpenEditorFiles,
  getActiveEditorFile,
  setOpenEditorFiles,
  setActiveEditorFile,
} from '@TTH/state/accessors'

export const closeEditorFile = (path: string) => {
  const files = getOpenEditorFiles().filter((f) => f !== path)
  setOpenEditorFiles(files)
  if (getActiveEditorFile() === path)
    setActiveEditorFile(files.length > 0 ? files[files.length - 1]! : null)
}
