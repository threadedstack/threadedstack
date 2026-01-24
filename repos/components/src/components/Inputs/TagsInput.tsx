import type { IInput } from '@TSC/types'

import { Tags } from '@TSC/components/Inputs/Inputs.styles'
import { cls } from '@keg-hub/jsutils/cls'
import { InputStateHandler } from './InputStateHandler'

type TagsInputProps = {
  placeholder?: string
  value?: string[]
  capitalize?: boolean
  oneTagPerLine?: boolean
  itemMap?: Record<string, any>
  setField?(field: string, value: string[], shouldValidate?: boolean): void
} & IInput &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'color'>

const TagsInput = (props: TagsInputProps): JSX.Element => {
  const {
    id,
    label,
    ignore,
    hidden,
    depends,
    tooltip,
    itemMap,
    setField,
    hasError,
    disabled,
    required,
    className,
    capitalize,
    helperText,
    oneTagPerLine,
    size = `small`,
    description = helperText,
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
      <Tags
        {...rest}
        fullWidth
        size={size}
        hideClearAll
        sx={{ my: 0.5 }}
        required={required}
        disabled={disabled}
        disableDeleteOnBackspace
        className={cls(
          className,
          `tdsk-tags-input`,
          hidden && `hidden`,
          hasError && `error`,
          disabled && `disabled`,
          required && `required`,
          oneTagPerLine && `one-tag-per-line`
        )}
        onChange={(value: string[]) => setField?.(id, value, false)}
        slotProps={{
          htmlInput: {
            id: id,
            name: id,
            className: cls(
              hidden && `hidden`,
              hasError && `error`,
              disabled && `disabled`,
              required && `required`
            ),
          },
        }}
      />
    </InputStateHandler>
  )
}

export { TagsInput }
export type { TagsInputProps }
