import { Icon, TIconProps } from './Icon'
import { forwardRef } from 'react'

export const VercelIcon = forwardRef((props: TIconProps, ref) => {
  return (
    <Icon
      title='vercel'
      {...props}
      ref={ref}
      viewBox='0 0 76 65'
      delta={'M37.5274 0L75.0548 65H0L37.5274 0Z'}
    />
  )
})
