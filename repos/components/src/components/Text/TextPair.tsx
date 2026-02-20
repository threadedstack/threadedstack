import type { TTextRef } from './Text'
import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material'
import type { TypographyProps } from '@mui/material/Typography'

import { Text } from './Text'
import { forwardRef } from 'react'
import Box from '@mui/material/Box'
import { cls } from '@keg-hub/jsutils/cls'
import { styled } from '@mui/material/styles'
import { inheritCss } from '@TSC/theme/helpers'

const PairContainer = styled(Box)`
  display: flex;
  align-items: center;
  justify-content: start;
`

const PairLabel = styled(Text)`
  ${inheritCss}
  &.tdsk-bold {
    font-weight: bold;
  }
`

const PairText = styled(Text)`
  ${inheritCss}
`

export type TTextPair = TypographyProps & {
  gap?: string
  text?: ReactNode
  label?: ReactNode
  sx?: SxProps<Theme>
  className?: string
  textClass?: string
  labelClass?: string
  boldLabel?: boolean
  size?: string | number
  children?: ReactNode
  textSx?: SxProps<Theme>
  labelSx?: SxProps<Theme>
  textProps?: TypographyProps
  labelProps?: TypographyProps
  textComponent?: TypographyProps[`component`]
  labelComponent?: TypographyProps[`component`]
  textColor?: string | TypographyProps[`color`]
  labelColor?: string | TypographyProps[`color`]
}

export const TextPair = forwardRef((props: TTextPair, ref: TTextRef) => {
  const {
    sx,
    size,
    text,
    label,
    textSx,
    labelSx,
    className,
    textClass,
    textColor,
    labelColor,
    labelClass,
    textProps,
    gap = `8px`,
    boldLabel,
    labelProps,
    children = text,
    textComponent = `div`,
    labelComponent = `div`,
    ...rest
  } = props

  return (
    <PairContainer
      {...rest}
      ref={ref}
      sx={
        [
          {
            gap,
            fontSize: size,
          },
          sx,
        ] as SxProps<Theme>
      }
      className={cls(`tdsk-tp-container`, className)}
    >
      {label && (
        <PairLabel
          {...rest}
          color={labelColor || rest.color}
          component={labelComponent || rest.component}
          {...labelProps}
          sx={[labelProps?.sx, labelSx] as SxProps<Theme>}
          className={cls(
            `tdsk-tp-label`,
            labelClass,
            boldLabel && `tdsk-bold`,
            labelProps?.className
          )}
        >
          {label}
        </PairLabel>
      )}
      {children && (
        <PairText
          {...rest}
          color={textColor || rest.color}
          component={textComponent || rest.component}
          {...textProps}
          sx={[textProps?.sx, textSx] as SxProps<Theme>}
          className={cls(`tdsk-tp-text`, textClass, textProps?.className)}
        >
          {children}
        </PairText>
      )}
    </PairContainer>
  )
})
