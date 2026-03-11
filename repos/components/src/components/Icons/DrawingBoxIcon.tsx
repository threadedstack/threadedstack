import { Icon, TIconProps } from './Icon'
import { forwardRef } from 'react'

export const DrawingBoxIcon = forwardRef((props: TIconProps, ref) => {
  return (
    <Icon
      title='drawing-box'
      {...props}
      ref={ref}
      viewBox='0 0 24 24'
      delta={
        'M18,18H12V12.21C11.34,12.82 10.47,13.2 9.5,13.2C7.46,13.2 5.8,11.54 5.8,9.5A3.7,3.7 0 0,1 9.5,5.8C11.54,5.8 13.2,7.46 13.2,9.5C13.2,10.47 12.82,11.34 12.21,12H18M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3Z'
      }
    />
  )
})
