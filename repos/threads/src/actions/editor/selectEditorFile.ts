import { setActiveEditorFile } from '@TTH/state/accessors'

export const selectEditorFile = (path: string) => {
  setActiveEditorFile(path)
}
