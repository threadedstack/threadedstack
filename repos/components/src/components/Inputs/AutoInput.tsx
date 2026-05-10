import type { HTMLAttributes } from 'react'
import type { IInput } from '@TSC/types'

import { cls } from '@keg-hub/jsutils/cls'
import Autocomplete from '@mui/material/Autocomplete'
import useTheme from '@mui/material/styles/useTheme'
import { InputStateHandler } from './InputStateHandler'
import { capitalize as caps } from '@keg-hub/jsutils/capitalize'
import {
  InputText,
  OptionDesc,
  OptionLabel,
  AutoOptionItem,
} from '@TSC/components/Inputs/Inputs.styles'

export type TAutoOption = {
  value: string
  label?: string
  description?: string
}

export type TAutoInput = {
  placeholder?: string
  optionClass?: string
  capitalize?: boolean
  options?: TAutoOption[]
  value?: string[]
  onChange?: (value: string[]) => void
} & IInput

type TOptionItem = HTMLAttributes<HTMLLIElement> & {
  option: TAutoOption
}

const OptionItem = ({ option, ...rest }: TOptionItem) => {
  return (
    <AutoOptionItem
      {...rest}
      className={cls(rest?.className, `tdsk-auto-option-item`)}
    >
      <OptionLabel>{option.label || caps(option.value)}</OptionLabel>
      {option.description && <OptionDesc>{option.description}</OptionDesc>}
    </AutoOptionItem>
  )
}

const AutoInput = (props: TAutoInput) => {
  const {
    id,
    sx,
    label,
    hidden,
    tooltip,
    options = [],
    value = [],
    onChange,
    required,
    hasError,
    disabled,
    className,
    capitalize,
    helperText,
    optionClass,
    placeholder,
    description = helperText,
  } = props

  const theme = useTheme()
  const isDarkMode = theme.palette.mode === `dark`

  return (
    <InputStateHandler
      id={id}
      label={label}
      hidden={hidden}
      tooltip={tooltip}
      required={required}
      disabled={disabled}
      hasError={hasError}
      description={description}
    >
      <Autocomplete
        sx={sx}
        id={id}
        multiple
        fullWidth
        options={options}
        disabled={disabled}
        disableCloseOnSelect
        filterSelectedOptions
        value={options.filter((o) => value.includes(o.value))}
        className={cls(
          className,
          `tdsk-auto-input`,
          hidden && `hidden`,
          disabled && `disabled`,
          required && `required`
        )}
        getOptionLabel={(option) =>
          capitalize ? caps(option.label || option.value) : option.label || option.value
        }
        isOptionEqualToValue={(option, val) => option.value === val.value}
        onChange={(_, selected) => onChange?.(selected.map((s) => s.value))}
        renderOption={(props, option) => (
          <OptionItem
            {...props}
            key={option.value}
            option={option}
            className={optionClass}
          />
        )}
        renderInput={(params) => (
          <InputText
            {...params}
            required={required}
            disabled={disabled}
            placeholder={!value.length ? placeholder : undefined}
          />
        )}
        slotProps={{
          paper: {
            sx: {
              boxShadow: theme.palette.colors.shadow,
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: isDarkMode ? theme.palette.grey[900] : undefined,
            },
          },
          listbox: {
            sx: {
              padding: `4px 0`,
            },
          },
        }}
      />
    </InputStateHandler>
  )
}

export { AutoInput }
