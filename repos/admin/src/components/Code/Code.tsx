import type { CSSProperties } from 'react'
import type { TMonaco } from '@tdsk/components'

import Box from '@mui/material/Box'
import { cls } from '@keg-hub/jsutils/cls'
import { styled } from '@mui/material/styles'
import { Monaco, InputLabel } from '@tdsk/components'

const CodeContainer = styled(Box)``

export type TCode = TMonaco & {
  label?: string
  error?: string
  tooltip?: string
  sx?: CSSProperties
  className?: string
  labelClass?: string
  noLabelDim?: boolean
  defaultValue?: string
  labelSx?: CSSProperties
}

const opts = {
  fontSize: 14,
}

export const Code = (props: TCode) => {
  const {
    sx,
    id,
    label,
    error,
    labelSx,
    options,
    tooltip,
    disabled,
    required,
    className,
    labelClass,
    noLabelDim,
    defaultValue,
    ...rest
  } = props

  return (
    <CodeContainer
      sx={sx}
      className={cls(`tdsk-code-container`, className)}
    >
      {(label && (
        <InputLabel
          id={id}
          sx={labelSx}
          tooltip={tooltip}
          required={required}
          label={label as string}
          className={cls(
            labelClass,
            error && `error`,
            `tdsk-code-label`,
            disabled && `disabled`,
            required && `required`,
            noLabelDim && `no-label-dim`
          )}
        />
      )) ||
        null}

      <Monaco
        id={id}
        hideCopy={true}
        hideClear={true}
        hideActions={true}
        hideLanguage={true}
        disabled={disabled}
        value={defaultValue}
        themeDark={`r-dark`}
        themeLight={`r-light`}
        defaultValue={defaultValue}
        options={options ? { ...options, ...opts } : opts}
        {...rest}
      />
    </CodeContainer>
  )
}
