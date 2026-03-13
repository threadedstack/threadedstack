// **IMPORTANT** - Don't use this component, it still needs work

import type { IInput } from '@TSC/types'

import {
  InputText,
  OptionDesc,
  OptionLabel,
  AutoOptionItem,
} from '@TSC/components/Inputs/Inputs.styles'
import { capitalize as caps } from '@keg-hub/jsutils/capitalize'
import { cls } from '@keg-hub/jsutils/cls'
import { isStr } from '@keg-hub/jsutils/isStr'
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import { InputStateHandler } from './InputStateHandler'

export type TOption = {
  value: string
  label?: string
  description?: string
}

type TAutoInput = {
  placeholder?: string
  initial?: string[]
  optionClass?: string
  capitalize?: boolean
  oneTagPerLine?: boolean
  values?: TOption[] | string[]
  itemMap?: Record<string, TOption>
  setField?(field: string, value: string[], shouldValidate?: boolean): void
} & IInput &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'color'>

const filterOptions = createFilterOptions<TOption>()

export type TOptionItem = {
  option: TOption
  className?: string
}

const OptionItem = ({ option, ...rest }: TOptionItem) => {
  return (
    <AutoOptionItem
      {...rest}
      className={cls(rest?.className, `tdsk-auto-option-item`)}
    >
      <OptionLabel>{option.label || caps(option.value)}</OptionLabel>
      <OptionDesc>{option.description}</OptionDesc>
    </AutoOptionItem>
  )
}

const AutoInput = (props: TAutoInput) => {
  const {
    id,
    label,
    ignore,
    hidden,
    values,
    depends,
    initial,
    tooltip,
    itemMap,
    required,
    multiple,
    setField,
    hasError,
    disabled,
    className,
    capitalize,
    helperText,
    optionClass,
    oneTagPerLine,
    description = helperText,
    size = `small`,
    ...rest
  } = props

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
        fullWidth
        className={cls(
          className,
          `tdsk-auto-input`,
          hidden && `hidden`,
          disabled && `disabled`,
          required && `required`
        )}
        multiple={multiple}
        options={values as TOption[]}
        ListboxProps={{
          style: {
            display: `flex`,
            alignItems: `center`,
            justifyContent: `start`,
            flexDirection: `column`,
            maxHeight: `initial`,
          },
        }}
        disableCloseOnSelect
        filterSelectedOptions
        filterOptions={filterOptions}
        getOptionLabel={(option) => {
          return !isStr(option) ? option.label : itemMap?.[option]?.label || caps(option)
        }}
        isOptionEqualToValue={(option, value) => option.value === value.value}
        renderOption={(props, option) => {
          const value = !isStr(option)
            ? option
            : itemMap?.[option] || { value: option, label: option }

          return (
            <OptionItem
              {...props}
              key={props.key}
              option={value}
              className={optionClass}
            />
          )
        }}
        renderInput={(params) => (
          <InputText
            required={required}
            disabled={disabled}
            {...params}
          />
        )}
      />
    </InputStateHandler>
  )
}

export { AutoInput }
export type { TAutoInput }
