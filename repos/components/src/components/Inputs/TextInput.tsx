import type { IInput } from '@TSC/types'
import type { MutableRefObject, ReactNode } from 'react'
import type { TextFieldProps } from '@mui/material/TextField'
import type { TextareaAutosizeProps } from '@mui/material/TextareaAutosize'

import { useMemo, useCallback } from 'react'
import { cls } from '@keg-hub/jsutils/cls'
import { isStr } from '@keg-hub/jsutils/isStr'
import { useTheme } from '@mui/material/styles'
import { autofillSx } from '@TSC/theme/helpers'
import { InputStateHandler } from '@TSC/components/Inputs/InputStateHandler'
import { Textarea, OutlinedInput } from '@TSC/components/Inputs/Inputs.styles'

export type TTextInput = {
  value?: string
  hidden?: string
  minRows?: number
  maxRows?: number
  fullWidth?: boolean
  textarea?: boolean
  noLabelDim?: boolean
  inputClass?: string
  labelClass?: string
  autoSelect?: boolean
  placeholder?: string
  endAdornment?: ReactNode
  startAdornment?: ReactNode
  inputRef?: MutableRefObject<HTMLInputElement | HTMLTextAreaElement>
} & IInput &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> &
  Pick<TextFieldProps, `multiline` | `slotProps` | `inputProps`>

export const TextInput = ({
  id,
  name,
  type,
  value,
  label,
  ignore,
  hidden,
  depends,
  onBlur,
  maxRows,
  minRows,
  tooltip,
  onFocus,
  inputRef,
  textarea,
  onChange,
  required,
  disabled,
  hasError,
  fullWidth,
  multiline,
  onKeyDown,
  className,
  inputClass,
  labelClass,
  noLabelDim,
  helperText,
  placeholder,
  autoSelect,
  inputProps,
  endAdornment,
  defaultValue,
  startAdornment,
  size = `small`,
  description = helperText,
  ...rest
}: TTextInput) => {
  const theme = useTheme()
  const aLabel = isStr(label) ? label : undefined
  const inSx = useMemo(() => {
    const style = {
      ...rest.sx,
      minHeight: multiline ? `100px` : `auto`,
      height: size === `small` ? `7px` : `15px`,
    }
    return { ...style, ...autofillSx(style.color || theme.palette.text.primary) }
  }, [size, theme, rest.sx, multiline])

  const onFocusCB = useCallback(
    (evt: any) => {
      onFocus?.(evt)
      autoSelect && evt.target.select()
    },
    [autoSelect, onFocus]
  )

  return (
    <InputStateHandler
      id={id}
      label={label}
      hidden={hidden}
      tooltip={tooltip}
      required={required}
      disabled={disabled}
      hasError={hasError}
      fullWidth={fullWidth}
      className={className}
      noLabelDim={noLabelDim}
      labelClass={labelClass}
      description={description}
    >
      {textarea ? (
        <Textarea
          id={id}
          value={value}
          style={rest.sx}
          name={name || id}
          minRows={minRows}
          maxRows={maxRows}
          aria-label={aLabel}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          ref={inputRef as MutableRefObject<HTMLTextAreaElement>}
          onBlur={onBlur as unknown as TextareaAutosizeProps['onBlur']}
          onFocus={onFocusCB as unknown as TextareaAutosizeProps['onFocus']}
          onChange={onChange as unknown as TextareaAutosizeProps['onChange']}
          onKeyDown={onKeyDown as unknown as TextareaAutosizeProps['onKeyDown']}
          className={cls(
            inputClass,
            hidden && `hidden`,
            hasError && `error`,
            disabled && `disabled`,
            required && `required`
          )}
        />
      ) : (
        <OutlinedInput
          fullWidth
          id={id}
          type={type}
          value={value}
          onBlur={onBlur}
          error={hasError}
          name={name || id}
          onFocus={onFocusCB}
          onChange={onChange}
          aria-label={aLabel}
          disabled={disabled}
          required={required}
          onKeyDown={onKeyDown}
          inputProps={inputProps}
          placeholder={placeholder}
          defaultValue={defaultValue}
          endAdornment={endAdornment}
          startAdornment={startAdornment}
          inputRef={inputRef as MutableRefObject<HTMLInputElement>}
          className={cls(
            inputClass,
            hidden && `hidden`,
            hasError && `error`,
            disabled && `disabled`,
            required && `required`
          )}
          slotProps={{
            input: {
              ...inputProps,
              sx: {
                fontWeight: 400,
                fontSize: `14px`,
                ...inputProps?.sx,
                ...inSx,
              },
            },
          }}
        />
      )}
    </InputStateHandler>
  )
}
