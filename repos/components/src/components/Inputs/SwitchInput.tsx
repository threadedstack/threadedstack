import type { IInput } from '@TSC/types'

import { colors } from '@TSC/theme'
import { cls } from '@keg-hub/jsutils/cls'
import styled from '@mui/material/styles/styled'
import { InputStateHandler } from './InputStateHandler'
import MSwitch, { SwitchProps as MSwitchProps } from '@mui/material/Switch'

type SwitchInputProps = IInput &
  MSwitchProps & {
    checked: boolean
    inputClass?: string
    labelClass?: string
    inputProps?: React.InputHTMLAttributes<HTMLInputElement>
    onChange: (event?: React.ChangeEvent<HTMLInputElement>, checked?: boolean) => void
  }

const SwitchInput = (props: SwitchInputProps): JSX.Element => {
  const {
    id,
    size,
    color,
    label,
    hidden,
    onBlur,
    tooltip,
    checked,
    hasError,
    onChange,
    disabled,
    required,
    onMouseUp,
    className,
    inputClass,
    inputProps,
    labelClass,
    description,
    onMouseDown,
  } = props

  return (
    <InputStateHandler
      id={id}
      label={label}
      hidden={hidden}
      tooltip={tooltip}
      disabled={disabled}
      hasError={hasError}
      required={required}
      className={className}
      labelClass={labelClass}
      description={description}
    >
      <StyledSwitchInput
        name={id}
        edge='end'
        size={size}
        color={color}
        onBlur={onBlur}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        required={required}
        onMouseUp={onMouseUp}
        inputProps={inputProps}
        onMouseDown={onMouseDown}
        className={cls(
          inputClass,
          hidden && `hidden`,
          hasError && `error`,
          disabled && `disabled`,
          required && `required`
        )}
      />
    </InputStateHandler>
  )
}

const StyledSwitchInput = styled((props: MSwitchProps) => (
  <MSwitch
    disableRipple
    focusVisibleClassName='.Mui-focusVisible'
    {...props}
  />
))(({ theme, size }) => {
  const isDarkMode = theme.palette.mode === 'dark'

  const dims =
    size === `small`
      ? {
          base: { padding: `2px` },
          root: { width: 30, height: 16 },
          thumb: { width: 12, height: 12 },
          checked: { transform: `translateX(14px)` },
        }
      : {
          base: { padding: `4px` },
          root: { width: 40, height: 24 },
          thumb: { width: 16, height: 16 },
          checked: { transform: `translateX(16px)` },
        }

  return {
    ...dims.root,
    padding: 0,
    [`& .MuiSwitch-switchBase`]: {
      ...dims.base,
      margin: 0,
      transitionDuration: '300ms',
      [`&.Mui-checked`]: {
        ...dims.checked,
        color: '#fff',
        [`& + .MuiSwitch-track`]: {
          backgroundColor: colors.states.success,
          opacity: 1,
          border: 0,
        },
        [`&.Mui-disabled + .MuiSwitch-track`]: {
          opacity: 0.5,
        },
      },
      [`&.Mui-disabled .MuiSwitch-thumb`]: {
        color: isDarkMode ? theme.palette.grey[600] : theme.palette.grey[100],
      },
      [`&.Mui-disabled + .MuiSwitch-track`]: {
        opacity: isDarkMode ? 0.3 : 0.7,
      },
    },
    [`& .MuiSwitch-thumb`]: {
      ...dims.thumb,
      boxShadow: `unset`,
      boxSizing: `border-box`,
    },
    [`& .MuiSwitch-track`]: {
      borderRadius: 26 / 2,
      backgroundColor: theme.palette.grey[400],
      opacity: 1,
      transition: theme.transitions.create([`background-color`], {
        duration: 500,
      }),
    },
  }
})

export { SwitchInput }
export type { SwitchInputProps }
