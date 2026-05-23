import { loadFileContent } from '@TTH/actions/editor/loadFileContent'
import {
  getOpenEditorFiles,
  setOpenEditorFiles,
  setActiveEditorFile,
} from '@TTH/state/accessors'

export const openEditorFile = (path: string) => {
  const current = getOpenEditorFiles()
  if (!current.includes(path)) setOpenEditorFiles([...current, path])

  setActiveEditorFile(path)
  loadFileContent(path).catch((err) => {
    console.warn(`[Editor] Failed to load ${path}:`, err)
  })
}
