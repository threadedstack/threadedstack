import { Icon, TIconProps } from './Icon'
import { forwardRef } from 'react'

export const ImportIcon = forwardRef((props: TIconProps, ref) => {
  return (
    <Icon
      title='import'
      {...props}
      ref={ref}
      viewBox='0 0 24 24'
      delta={
        'M14,12L10,8V11H2V13H10V16M20,18V6C20,4.89 19.1,4 18,4H6A2,2 0 0,0 4,6V9H6V6H18V18H6V15H4V18A2,2 0 0,0 6,20H18A2,2 0 0,0 20,18Z'
      }
    />
  )
})
