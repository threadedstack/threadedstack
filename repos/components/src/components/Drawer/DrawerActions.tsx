import type { TButton } from '@TSC/components/Buttons/Button'

import { useMemo } from 'react'
import Box from '@mui/material/Box'
import { Button } from '@TSC/components/Buttons/Button'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { LoadingButton } from '@TSC/components/Buttons/LoadingButton'
import NotInterestedOutlinedIcon from '@mui/icons-material/NotInterestedOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined'

type TDrawerAction = Partial<TButton>

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
  form?: string
  editing?: boolean
  loading?: boolean
  disabled?: boolean
  type?: `button` | `submit` | `reset`
  actions?: Record<string, TDrawerAction>
}

export const DrawerActions = (props: TDrawerActions) => {
  const { form, type, actions, editing, loading, disabled } = props

  const { remove, cancel, save, create, ...merged } = useMemo(() => {
    const save = {
      ...DefActions.save,
      text: loading ? `Saving...` : DefActions.save.text,
      ...actions?.save,
    }

    return {
      ...DefActions,
      ...actions,
      save,
      remove: {
        ...DefActions.remove,
        ...actions?.remove,
      },
      cancel: {
        ...DefActions.cancel,
        ...actions?.cancel,
      },
      create: {
        ...save,
        ...DefActions.create,
        ...actions?.create,
      },
    }
  }, [actions, loading])

  return (
    <>
      {editing && (
        <Button
          {...remove}
          disabled={disabled || loading}
        />
      )}
      <Button
        {...cancel}
        disabled={disabled || loading}
      />
      <LoadingButton
        type={type}
        form={form}
        {...(editing ? save : create)}
        loading={loading}
        disabled={disabled || loading}
      />
    </>
  )
}
