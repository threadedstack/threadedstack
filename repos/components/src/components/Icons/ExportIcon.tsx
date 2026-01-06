import { Icon, TIconProps } from './Icon'
import { forwardRef } from 'react'

export const ExportIcon = forwardRef((props: TIconProps, ref) => {
  return (
    <Icon
      title='export'
      {...props}
      ref={ref}
      viewBox='0 0 24 24'
      delta={
        'M23,12L19,8V11H10V13H19V16M1,18V6C1,4.89 1.9,4 3,4H15A2,2 0 0,1 17,6V9H15V6H3V18H15V15H17V18A2,2 0 0,1 15,20H3A2,2 0 0,1 1,18Z'
      }
    />
  )
})
