import type { CSSProperties, ElementType, MouseEvent, ReactNode } from 'react'

import { useJoinSx } from '@TSC/hooks/theme/useJoinSx'
import { exists } from '@keg-hub/jsutils/exists'
import SvgIcon from '@mui/material/SvgIcon'
import { forwardRef, useMemo } from 'react'

export type TIconProps = {
  id?:string
  d?: string
  Icon?: any
  role?:string
  fill?: string
  title?: string
  delta?: string
  color?: string
  stroke?: string
  viewBox?: string
  tabIndex?:number
  definition?: string
  className?: string
  RootEl?: ElementType
  children?: ReactNode
  width?: string | number
  height?: string | number
  attrs?: Record<any, any>
  inheritViewBox?: boolean
  sx?: CSSProperties
  style?: CSSProperties
  styles?: CSSProperties
  svgStyle?: CSSProperties
  preserveAspectRatio?: string
  onClick?: (event: MouseEvent<SVGSVGElement>) => void
}

export const Icon = forwardRef((props: TIconProps, ref) => {
  const {
    d,
    sx,
    color,
    title,
    width,
    height,
    attrs,
    style,
    styles,
    delta = d,
    viewBox,
    children,
    svgStyle,
    className,
    RootEl = SvgIcon,
    Icon: IconComp,
    inheritViewBox,
    definition = delta,
    ...rootProps
  } = props

  const joinedSx = useJoinSx(
    sx as CSSProperties,
    svgStyle,
    styles,
    style,
    { height, width, color }
  )

  const withViewBox = useMemo(() => {
    return exists(inheritViewBox) ? inheritViewBox : !viewBox
  }, [inheritViewBox, viewBox])

  return (
    <RootEl
      ref={ref}
      sx={joinedSx}
      width={width}
      height={height}
      viewBox={viewBox}
      className={className}
      inheritViewBox={withViewBox}
      {...rootProps}
    >
      {title && <title>{title}</title>}
      {IconComp && <IconComp className={className} />}
      {definition && (
        <path
          {...attrs}
          d={definition}
        ></path>
      )}
      {children}
    </RootEl>
  )
})
