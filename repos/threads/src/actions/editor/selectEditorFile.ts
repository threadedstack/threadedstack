import { loadFileContent } from '@TTH/actions/editor/loadFileContent'
import { setActiveEditorFile, getFileContentCache } from '@TTH/state/accessors'

export const selectEditorFile = (path: string) => {
  setActiveEditorFile(path)
  if (!getFileContentCache().has(path)) {
    loadFileContent(path).catch((err) => {
      console.warn(`[Editor] Failed to load ${path}:`, err)
    })
  }
}
