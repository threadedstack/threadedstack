import type { IInput } from '@TSC/types'
import type { CSSProperties, ReactNode } from 'react'
import type { CheckboxProps } from '@mui/material/Checkbox'
import type { FormControlLabelProps } from '@mui/material/FormControlLabel'

import { cls } from '@keg-hub/jsutils/cls'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputLabel from '@mui/material/InputLabel'

export type TCheckboxInput = IInput &
  CheckboxProps & {
    labelSx?: CSSProperties
    labelClass?: string
    checkboxSx?: CSSProperties
    checkboxClass?: string
  } & Pick<FormControlLabelProps, `labelPlacement`>

const getThemeColor = (palette: any) => {
  return palette.mode === `light` ? palette.primary.main : palette.text.primary
}

const getColor = (checked: boolean, palette: any) => {
  return !checked ? `grey.500` : getThemeColor(palette)
}

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
    labelPlacement,
    checkboxClass,
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
                color: (theme) => getColor(checked, theme.palette),
                [`&:hover`]: {
                  color: (theme) => getThemeColor(theme.palette),
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
                color: (theme) => getColor(checked, theme.palette),
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
