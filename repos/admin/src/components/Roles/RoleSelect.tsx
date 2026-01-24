import type { TRoleType } from '@tdsk/domain'
import type { SxProps } from '@mui/material'

import { Alert } from '@mui/material'
import { ERoleType } from '@tdsk/domain'
import { cls } from '@keg-hub/jsutils/cls'
import { SelectInput } from '@tdsk/components'
import { AuthRoles } from '@TAF/constants/values'

export type TRoleSelect = {
  id?: string
  sx?: SxProps
  label?: string
  className?: string
  disabled?: boolean
  showAlert?: boolean
  roleType?: TRoleType
  onChange: (e: any) => void
}

export const RoleSelect = (props: TRoleSelect) => {
  const {
    id,
    sx,
    className,
    disabled,
    roleType,
    onChange,
    showAlert,
    label = `Role`,
  } = props

  return (
    <>
      <SelectInput
        id={id}
        sx={sx}
        label={label}
        items={AuthRoles}
        disabled={disabled}
        onChange={onChange}
        value={roleType ?? ERoleType.viewer}
        className={cls(className, `tdsk-role-select`)}
      />
      {(showAlert && (
        <Alert severity='info'>
          Note: Super admin roles cannot be modified through this interface.
        </Alert>
      )) ||
        null}
    </>
  )
}
