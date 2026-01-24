import type { ReactNode, CSSProperties } from 'react'

import { Typography } from '@mui/material'
import { Confirm } from '@TSC/components/Confirm/Confirm'

export type TConfirmDelete = {
  open?: boolean
  text?: ReactNode
  title?: ReactNode
  itemName: string
  deleting?: boolean
  sx?: CSSProperties
  warnText?: string
  cancelText?: string
  deleteText?: string
  confirmText?: string
  onCancel: () => void
  onConfirm: () => void
}

export const ConfirmDelete = (props: TConfirmDelete) => {
  const {
    sx,
    text,
    title,
    warnText,
    itemName,
    onCancel,
    onConfirm,
    open = true,
    deleting = false,
    cancelText = `Cancel`,
    confirmText = `Confirm`,
    deleteText = `Deleting...`,
  } = props

  return (
    <Confirm
      sx={sx}
      open={open}
      maxWidth='md'
      loading={deleting}
      cancel={cancelText}
      onCancel={onCancel}
      onConfirm={onConfirm}
      confirm={deleting ? deleteText : confirmText}
      title={title ? title : itemName ? `Delete ${itemName}` : `Confirm Delete`}
    >
      <>
        {text || (
          <Typography
            mt={2}
            variant='body1'
            component='span'
          >
            Are you sure you want to delete <strong>"{itemName}"</strong> ?
          </Typography>
        )}
        {(warnText && (
          <Typography
            my={2}
            variant='body2'
            component='span'
            color='text.secondary'
          >
            {warnText}
          </Typography>
        )) ||
          null}
      </>
    </Confirm>
  )
}
