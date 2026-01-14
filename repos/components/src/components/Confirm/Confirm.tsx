import type { ComponentType, CSSProperties, ReactNode } from 'react'

import {
  ConfirmTitle,
  ConfirmDialog,
  ConfirmContent,
  ConfirmCancelBtn,
  ConfirmHeaderIcon,
  ConfirmDialogActions,
} from '@TSC/components/Confirm/Confirm.styles'

import { cls } from '@keg-hub/jsutils/cls'
import { inherit } from '@TSC/theme/helpers'
import { isStr } from '@keg-hub/jsutils/isStr'
import { stopEvent } from '@TSC/utils/helpers'
import CloseIcon from '@mui/icons-material/Close'
import CheckIcon from '@mui/icons-material/Check'
import { isValidFuncComp } from '@TSC/utils/isValidFuncComp'
import DialogContentText from '@mui/material/DialogContentText'
import { LoadingButton } from '@TSC/components/Buttons/LoadingButton'

export type TConfirm = {
  open?: boolean
  title?: ReactNode
  cancel?: ReactNode
  confirm?: ReactNode
  children?: ReactNode
  fullWidth?: boolean
  sx?: CSSProperties
  loading?: boolean
  iconSx?: CSSProperties
  titleSx?: CSSProperties
  contentSx?: CSSProperties
  actionsSx?: CSSProperties
  disableEscape?: boolean
  scroll?: `body` | `paper`
  className?: string | string[]
  PaperProps?: Record<string, any>
  HeaderIcon?: ComponentType<any> | ReactNode
  CancelIcon?: ComponentType<any> | ReactNode
  ConfirmIcon?: ComponentType<any> | ReactNode
  onClose?: (evt: any, confirmed?: boolean) => any
  onCancel?: (evt: any, confirmed?: boolean) => any
  onConfirm?: (evt: any, confirmed?: boolean) => any
  maxWidth?: `xs` | `sm` | `md` | `lg` | `xl` | false | string
}

export const Confirm = (props: TConfirm) => {
  const {
    sx,
    open,
    scroll,
    iconSx,
    titleSx,
    loading,
    onClose,
    onCancel,
    children,
    onConfirm,
    contentSx,
    actionsSx,
    className,
    maxWidth,
    fullWidth,
    PaperProps,
    disableEscape,
    title = `Confirm`,
    cancel = `Cancel`,
    confirm = `Confirm`,
    CancelIcon = CloseIcon,
    ConfirmIcon = CheckIcon,
    HeaderIcon = ConfirmHeaderIcon,
  } = props

  const onCloseCB = (evt?: any, reason?: any) => {
    evt && stopEvent(evt)
    if (onClose) return onClose?.(evt)
    onCancel?.(evt)
  }

  const onCancelCB = (evt?: any, reason?: any) => {
    evt && stopEvent(evt)
    onCancel?.(evt)
  }

  const onConfirmCB = async (evt: any) => {
    evt && stopEvent(evt)
    onConfirm?.(evt, true)
  }

  return (
    (open && (
      <ConfirmDialog
        sx={sx}
        open={open}
        scroll={scroll}
        onClose={onCloseCB}
        fullWidth={fullWidth}
        PaperProps={PaperProps}
        maxWidth={maxWidth as any}
        closeAfterTransition={false}
        onClick={(evt: any) => stopEvent(evt)}
        disableEscapeKeyDown={disableEscape}
        aria-labelledby='tdsk-confirm-dialog-title'
        aria-describedby='tdsk-confirm-dialog-description'
        className={cls(`tdsk-confirm-dialog`, className)}
      >
        {(title && (
          <ConfirmTitle
            id='tdsk-confirm-dialog-title'
            sx={titleSx}
          >
            {HeaderIcon ? (
              isValidFuncComp(HeaderIcon) ? (
                <HeaderIcon sx={[inherit, iconSx]} />
              ) : (
                HeaderIcon
              )
            ) : null}
            {title}
          </ConfirmTitle>
        )) ||
          null}

        {(children && (
          <ConfirmContent
            sx={contentSx}
            className='tdsk-confirm-dialog-content'
          >
            {isStr(children) ? (
              <DialogContentText id='tdsk-confirm-dialog-description'>
                {children}
              </DialogContentText>
            ) : (
              children
            )}
          </ConfirmContent>
        )) ||
          null}

        {((cancel || confirm) && (
          <ConfirmDialogActions
            className='tdsk-confirm-dialog-actions'
            sx={actionsSx}
          >
            {(cancel && (
              <ConfirmCancelBtn
                color='error'
                Icon={CancelIcon}
                variant='outlined'
                onClick={onCancelCB}
                className='tdsk-confirm-dialog-cancel-button'
              >
                {cancel}
              </ConfirmCancelBtn>
            )) ||
              null}

            {(confirm && (
              <LoadingButton
                autoFocus
                color='success'
                loading={loading}
                Icon={ConfirmIcon}
                variant='contained'
                onClick={onConfirmCB}
                className='tdsk-confirm-dialog-confirm-button'
              >
                {confirm}
              </LoadingButton>
            )) ||
              null}
          </ConfirmDialogActions>
        )) ||
          null}
      </ConfirmDialog>
    )) ||
    null
  )
}
