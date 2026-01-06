import type { IInput } from '@TSC/types'
import type { SxProps } from '@mui/material'

import { cls } from '@keg-hub/jsutils/cls'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import { InputLabel } from '@TSC/components/Inputs/InputLabel'
import { InputStateStack } from '@TSC/components/Inputs/Inputs.styles'

type InputStateHandlerProps = {
  children: React.ReactNode
  sx?: SxProps
  hidden?: boolean
  fullWidth?: boolean
  noLabelDim?: boolean
  labelClass?: string
} & IInput

const InputStateHandler = (props: InputStateHandlerProps): JSX.Element => {
  const {
    sx,
    id,
    label,
    hidden,
    tooltip,
    children,
    hasError,
    disabled,
    required,
    fullWidth,
    className,
    noLabelDim,
    labelClass,
    description,
    notificationsProps,
  } = props

  return (
    <InputStateStack
      sx={sx}
      gap={0.5}
      className={cls(
        className,
        hidden && `hidden`,
        hasError && `error`,
        disabled && `disabled`,
        required && `required`,
        noLabelDim && `no-label-dim`,
        fullWidth && `full-width`
      )}
    >
      {label ? (
        <InputLabel
          id={id}
          tooltip={tooltip}
          required={required}
          noLabelDim={noLabelDim}
          label={label as string}
          notificationsProps={notificationsProps}
          className={cls(
            labelClass,
            hasError && `error`,
            disabled && `disabled`,
            required && `required`,
            noLabelDim && `no-label-dim`
          )}
        />
      ) : null}
      <FormControl
        error={hasError}
        fullWidth
      >
        {children}
        {description ? <FormHelperText>{description}</FormHelperText> : null}
      </FormControl>
    </InputStateStack>
  )
}

export { InputStateHandler }
export type { InputStateHandlerProps }
