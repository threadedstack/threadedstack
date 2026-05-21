import { setOpenEditorFiles, setActiveEditorFile } from '@TTH/state/accessors'

export const closeAllEditorFiles = () => {
  setOpenEditorFiles([])
  setActiveEditorFile(null)
}
