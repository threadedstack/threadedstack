import { Icon, TIconProps } from './Icon'
import { forwardRef } from 'react'

export const ItemListIcon = forwardRef((props:TIconProps, ref) => {
  return (
    <Icon
      {...props}
      ref={ref}
      title='item-list-icon'
      viewBox="0 0 24 24"
      delta={
        'M9,5V9H21V5M9,19H21V15H9M9,14H21V10H9M4,9H8V5H4M4,19H8V15H4M4,14H8V10H4V14Z'
      }
    />
  )
})