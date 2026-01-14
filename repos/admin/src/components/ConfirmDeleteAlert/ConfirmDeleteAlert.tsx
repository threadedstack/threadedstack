import type { ReactNode, CSSProperties } from 'react'

import { Confirm } from '@tdsk/components'

export type TConfirmDeleteAlert = {
  text?: ReactNode
  title?: ReactNode
  itemName: string
  deleting?: boolean
  sx?: CSSProperties
  cancelText?: string
  deleteText?: string
  confirmText?: string
  onCancel: () => void
  onConfirm: () => void
}

export const ConfirmDeleteAlert = (props: TConfirmDeleteAlert) => {
  const {
    sx,
    title,
    itemName,
    onCancel,
    onConfirm,
    deleting = false,
    cancelText = `Cancel`,
    confirmText = `Confirm`,
    deleteText = `Deleting...`,
    text = `Are you sure you want to delete "${itemName}"?`,
  } = props

  return (
    <Confirm
      open
      sx={sx}
      title={title}
      loading={deleting}
      cancel={cancelText}
      onCancel={onCancel}
      onConfirm={onConfirm}
      confirm={deleting ? deleteText : confirmText}
    >
      {text}
    </Confirm>
  )
}

export default ConfirmDeleteAlert
