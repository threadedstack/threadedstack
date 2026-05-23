import { closeRelatedTabs } from '@TTH/actions/editor/editorCleanup'

export const closeEditorFile = (path: string) => {
  closeRelatedTabs(path, false)
}
