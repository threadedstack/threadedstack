import { Button } from '@TSC/components/Buttons/Button'
import { LoadingButton } from '@TSC/components/Buttons/LoadingButton'
import { CancelIcon, ConfirmIcon } from '@TSC/components/Dialog/Dialog.styles'
import { cls } from '@keg-hub/jsutils'
import { ReactNode } from 'react'

export type TDialogActions = {
  afterActions?: ReactNode
  beforeActions?: ReactNode
  SubmitIcon?: any
  CloseIcon?: any
  loading?: boolean
  closeText?: string
  closeColor?: string
  closeType?: string
  closeTooltip?: string
  closeVariant?: string
  closeDisabled?: boolean
  closeClass?: string | string[]
  submitText?: string
  submitType?: string
  submitColor?: string
  submitVariant?: string
  submitTooltip?: string
  submitDisabled?: boolean
  submitClass?: string | string[]
  onSubmit?: (...args: any[]) => void
  onClose?: (...args: any[]) => void
}

export const DialogActions = (props: TDialogActions) => {
  const {
    loading,
    onClose,
    closeType,
    closeClass,
    closeTooltip,
    closeDisabled,
    closeText = 'Cancel',
    closeVariant = 'text',
    closeColor = 'secondary',
    onSubmit,
    submitType,
    submitColor,
    submitClass,
    submitDisabled,
    submitTooltip,
    submitText = 'Submit',
    submitVariant = 'contained',
    CloseIcon = CancelIcon,
    SubmitIcon = ConfirmIcon,
    afterActions,
    beforeActions,
  } = props

  return (
    <>
      {beforeActions}
      <Button
        onClick={onClose}
        Icon={CloseIcon}
        tooltip={closeTooltip}
        type={closeType as any}
        disabled={closeDisabled}
        color={closeColor as any}
        variant={closeVariant as any}
        className={cls(closeClass, `tdsk-dialog-close-action`)}
      >
        {closeText}
      </Button>
      <LoadingButton
        loading={loading}
        Icon={SubmitIcon}
        onClick={onSubmit}
        type={submitType as any}
        tooltip={submitTooltip}
        disabled={submitDisabled}
        color={submitColor as any}
        variant={submitVariant as any}
        className={cls(submitClass, `tdsk-dialog-submit-action`)}
      >
        {submitText}
      </LoadingButton>
      {afterActions}
    </>
  )
}
