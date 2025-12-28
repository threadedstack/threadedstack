import type { BoxProps } from '@mui/material/Box'
import type { DialogProps as MDialogProps } from '@mui/material/Dialog'
import type { DialogActionsProps } from '@mui/material/DialogActions'
import type { DialogContentProps } from '@mui/material/DialogContent'
import type { DialogTitleProps } from '@mui/material/DialogTitle'
import type { ReactNode } from 'react'

import {
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@TSC/components/Dialog/Dialog.styles'
import { cls } from '@keg-hub/jsutils/cls'
import Box from '@mui/material/Box'
import MDialog from '@mui/material/Dialog'
import grey from '@mui/material/colors/grey'
import {
  colors
} from '@TSC/theme/colors'

export type DialogProps = {
  title?: ReactNode
  actions?: ReactNode
  content?: ReactNode
  TitleIcon?: ReactNode
  containerProps?: BoxProps
  titleProps?: DialogTitleProps
  actionProps?: DialogActionsProps
  contentProps?: DialogContentProps
} & Omit<MDialogProps, 'content' | 'title'>

export const Dialog = (props: DialogProps) => {
  const {
    sx,
    title,
    actions,
    content,
    TitleIcon,
    titleProps,
    actionProps,
    contentProps,
    containerProps,
    ...rest
  } = props

  return (
    <MDialog
      fullWidth
      {...rest}
      sx={{
        borderRadius: 1,
        border: (theme) => theme.palette.border.default,
        ...(sx || {}),
      }}
    >
      <Box
        bgcolor='background.paper'
        {...containerProps}
      >
        {title ? (
          <DialogTitle
            {...titleProps}
            className={cls(`tdsk-dialog-title`, titleProps?.className)}
          >
            <span className='tdsk-dialog-title-icon'>{TitleIcon}</span>
            {title}
          </DialogTitle>
        ) : null}

        {content ? <DialogContent {...contentProps}>{content}</DialogContent> : null}

        {actions ? (
          <DialogActions
            {...actionProps}
            sx={actionProps?.sx}
          >
            {actions}
          </DialogActions>
        ) : null}
      </Box>
    </MDialog>
  )
}

export default Dialog
