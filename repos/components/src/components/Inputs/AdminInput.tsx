import type { TReactEl } from '@TSC/types'

import { FormHelperText, FormLabel } from '@mui/material'

import { CheckContainer } from '@TSC/components/Inputs/CheckContainer'
import { InputContainer } from '@TSC/components/Inputs/InputContainer'
import { TextInput } from '@TSC/components/Inputs/TextInput'
import { cls } from '@keg-hub/jsutils/cls'

export type TAdminInput = {
  id: string
  label?: string
  error?: string
  hidden?: boolean
  disabled?: boolean
  required?: boolean
  minRows?: number
  maxRows?: number
  Input?: TReactEl
  touched?: boolean
  checkbox?: boolean
  textarea?: boolean
  inputClass?: string
  labelClass?: string
  className?: string
  placeholder?: string
  Container?: TReactEl
  inputProps: Record<string, any>
}

export const AdminInput = (props: TAdminInput) => {
  const {
    id,
    label,
    error,
    hidden,
    maxRows,
    minRows,
    touched,
    checkbox,
    textarea,
    disabled,
    required,
    className,
    labelClass,
    inputClass,
    inputProps,
    placeholder,
  } = props

  const Input = props.Input || TextInput
  const Container = props.Container || (checkbox ? CheckContainer : InputContainer)

  return (
    <Container
      className={cls(
        className,
        hidden && `hidden`,
        disabled && `disabled`,
        required && `required`,
        touched && error && `error`
      )}
    >
      {label && (
        <FormLabel
          htmlFor={id}
          disabled={disabled}
          required={required}
          className={cls(
            labelClass,
            hidden && `hidden`,
            disabled && `disabled`,
            required && `required`,
            touched && error && `error`
          )}
        >
          {label}
        </FormLabel>
      )}
      <Input
        id={id}
        maxRows={maxRows}
        minRows={minRows}
        disabled={disabled}
        required={required}
        textarea={textarea}
        placeholder={placeholder}
        {...inputProps}
        className={cls(
          inputClass,
          hidden && `hidden`,
          inputProps?.className,
          disabled && `disabled`,
          required && `required`,
          touched && error && `error`
        )}
      />
      {touched && error && <FormHelperText error>{error}</FormHelperText>}
    </Container>
  )
}
