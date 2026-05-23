import type { TFileTreeAction } from '@TTH/types'

import { toggleFolder } from '@TTH/actions/editor/toggleFolder'
import { getExpandedFolders, setFileTreeAction } from '@TTH/state/accessors'

export const startFileTreeAction = (action: TFileTreeAction) => {
  if (
    (action.type === `create-file` || action.type === `create-folder`) &&
    !getExpandedFolders().has(action.parentPath)
  ) {
    toggleFolder(action.parentPath)
  }
  setFileTreeAction(action)
}

export const cancelFileTreeAction = () => {
  setFileTreeAction(null)
}
