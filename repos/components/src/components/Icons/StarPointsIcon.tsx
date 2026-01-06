import { Icon, TIconProps } from './Icon'
import { forwardRef } from 'react'

export const StarPointsIcon = forwardRef((props: TIconProps, ref) => {
  return (
    <Icon
      {...props}
      ref={ref}
      title='star-points'
      viewBox='0 0 24 24'
      delta={
        'M10.74 10.75L12 8L13.25 10.75L16 12L13.25 13.26L12 16L10.74 13.26L8 12L10.74 10.75Z'
      }
    />
  )
})
