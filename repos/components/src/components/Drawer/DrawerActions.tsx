import type { TButton } from '@TSC/components/Buttons/Button'

import { useMemo } from 'react'
import Box from '@mui/material/Box'
import type { SxProps } from '@mui/material'
import { styled } from '@mui/material/styles'
import { Button } from '@TSC/components/Buttons/Button'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { LoadingButton } from '@TSC/components/Buttons/LoadingButton'
import NotInterestedOutlinedIcon from '@mui/icons-material/NotInterestedOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined'
import { exists } from '@keg-hub/jsutils/exists'

type TDrawerAction = Partial<TButton>

const ActionsContainer = styled(Box)(({ theme }) => ({
  width: `100%`,
  display: `flex`,
  alignItems: `center`,
  gap: theme.gutter.mpx,
  justifyContent: `space-between`,
  padding: `${theme.gutter.px} ${theme.gutter.mpx}`,
}))

const DefActions: Record<string, TDrawerAction> = {
  remove: {
    color: `error`,
    text: `Delete`,
    Icon: DeleteOutlineOutlinedIcon,
  },
  cancel: {
    text: `Cancel`,
    color: `warning`,
    variant: `outlined`,
    Icon: NotInterestedOutlinedIcon,
  },
  save: {
    text: `Save`,
    color: `success`,
    variant: `contained`,
    Icon: SaveOutlinedIcon,
  },
  create: {
    text: `Create`,
    variant: `contained`,
    Icon: AddCircleOutlineOutlinedIcon,
  },
}

export type TDrawerActions = {
  sx?: SxProps
  form?: string
  editing?: boolean
  loading?: boolean
  disabled?: boolean
  saveDisabled?: boolean
  removeDisabled?: boolean
  createDisabled?: boolean
  cancelDisabled?: boolean
  type?: `button` | `submit` | `reset`
  actions?: Record<string, TDrawerAction>
}

export const DrawerActions = (props: TDrawerActions) => {
  const {
    sx,
    form,
    type,
    actions,
    editing,
    loading,
    disabled,
    saveDisabled,
    removeDisabled,
    createDisabled,
    cancelDisabled,
  } = props

  const { save, create, remove, cancel, ...merged } = useMemo(() => {
    const isDisabled = disabled || loading

    const save = {
      ...DefActions.save,
      text: loading ? `Saving...` : DefActions.save.text,
      ...actions?.save,
      disabled: exists(saveDisabled) ? saveDisabled : isDisabled,
    }

    return {
      ...DefActions,
      ...actions,
      save,
      remove: {
        ...DefActions.remove,
        ...actions?.remove,
        disabled: exists(removeDisabled) ? removeDisabled : isDisabled,
      },
      cancel: {
        ...DefActions.cancel,
        ...actions?.cancel,
        disabled: exists(cancelDisabled) ? cancelDisabled : isDisabled,
      },
      create: {
        ...save,
        ...DefActions.create,
        ...actions?.create,
        disabled: exists(createDisabled) ? createDisabled : save.disabled,
      },
    }
  }, [
    actions,
    loading,
    disabled,
    saveDisabled,
    removeDisabled,
    createDisabled,
    cancelDisabled,
  ])

  return (
    <ActionsContainer sx={sx}>
      {(editing && <Button {...remove} />) || <Box />}
      <Box
        gap={3}
        display='flex'
      >
        <Button {...cancel} />
        <LoadingButton
          type={type}
          form={form}
          {...(editing ? save : create)}
          loading={loading}
        />
      </Box>
    </ActionsContainer>
  )
}
