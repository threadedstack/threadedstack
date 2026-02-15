import type { IInput } from '@TSC/types'
import type { CSSProperties } from 'react'
import type { CheckboxProps } from '@mui/material/Checkbox'
import type { FormControlLabelProps } from '@mui/material/FormControlLabel'

import Box from '@mui/material/Box'
import { cls } from '@keg-hub/jsutils/cls'
import Checkbox from '@mui/material/Checkbox'
import InputLabel from '@mui/material/InputLabel'
import FormControlLabel from '@mui/material/FormControlLabel'

export type TCheckboxInput = IInput &
  CheckboxProps & {
    labelSx?: CSSProperties
    labelClass?: string
    checkboxSx?: CSSProperties
    checkboxClass?: string
  } & Pick<FormControlLabelProps, `labelPlacement`>

export const CheckboxInput = (props: TCheckboxInput) => {
  const {
    sx,
    label,
    hidden,
    checked,
    labelSx,
    tooltip,
    onClick,
    disabled,
    onChange,
    required,
    hasError,
    className,
    labelClass,
    checkboxSx,
    helperText,
    description,
    checkboxClass,
    labelPlacement,
    ...rest
  } = props

  return (
    <FormControlLabel
      sx={sx}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      required={required}
      labelPlacement={labelPlacement}
      className={cls(
        className,
        hidden && `hidden`,
        hasError && `error`,
        disabled && `disabled`
      )}
      label={
        <Box onClick={(evt: any) => onChange(evt, !checked)}>
          <InputLabel
            className={cls(
              labelClass,
              hidden && `hidden`,
              hasError && `error`,
              disabled && `disabled`,
              required && `required`
            )}
            sx={[
              {
                fontWeight: 600,
                fontSize: `12px`,
                cursor: `pointer`,
                color: (theme) => (!checked ? `grey.500` : theme.palette.primary.main),
                [`&:hover`]: {
                  color: (theme) => theme.palette.primary.main,
                },
              },
              labelSx,
            ]}
          >
            {label}
          </InputLabel>
        </Box>
      }
      control={
        <Checkbox
          disabled={disabled}
          required={required}
          className={cls(
            checkboxClass,
            hidden && `hidden`,
            hasError && `error`,
            disabled && `disabled`,
            required && `required`
          )}
          sx={[
            {
              [`& svg`]: {
                color: (theme) => (!checked ? `grey.500` : theme.palette.primary.main),
              },
            },
            checkboxSx,
          ]}
          {...rest}
        />
      }
    />
  )
}
