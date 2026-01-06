import type { ComponentProps, CSSProperties } from 'react'
import type { TTextRef } from './Text'
import { forwardRef, useMemo } from 'react'
import { Text } from './Text'
import { inherit } from '@TSC/theme/helpers'

export type TTextEl = ComponentProps<typeof Text>

export const H1 = forwardRef((props: TTextEl, ref: TTextRef) => (
  <Text
    variant='h1'
    component='h1'
    {...props}
    ref={ref}
    sx={useMemo(() => [inherit, props.sx], [inherit, props.sx]) as CSSProperties[]}
  />
))
export const H2 = forwardRef((props: TTextEl, ref: TTextRef) => (
  <Text
    variant='h2'
    component='h2'
    {...props}
    ref={ref}
  />
))
export const H3 = forwardRef((props: TTextEl, ref: TTextRef) => (
  <Text
    variant='h3'
    component='h3'
    {...props}
    ref={ref}
  />
))
export const H4 = forwardRef((props: TTextEl, ref: TTextRef) => (
  <Text
    variant='h4'
    component='h4'
    {...props}
    ref={ref}
  />
))
export const H5 = forwardRef((props: TTextEl, ref: TTextRef) => (
  <Text
    variant='h5'
    component='h5'
    {...props}
    ref={ref}
  />
))
export const H6 = forwardRef((props: TTextEl, ref: TTextRef) => (
  <Text
    variant='h6'
    component='h6'
    {...props}
    ref={ref}
  />
))
export const Paragraph = forwardRef((props: TTextEl, ref: TTextRef) => (
  <Text
    variant='body1'
    component='p'
    {...props}
    ref={ref}
  />
))
export const Span = forwardRef((props: TTextEl, ref: TTextRef) => (
  <Text
    component='span'
    {...props}
    ref={ref}
    sx={useMemo(() => [inherit, props.sx], [inherit, props.sx]) as CSSProperties[]}
  />
))
export const Label = forwardRef((props: TTextEl, ref: TTextRef) => (
  <Text
    component='label'
    {...props}
    ref={ref}
  />
))

export { Paragraph as P }
