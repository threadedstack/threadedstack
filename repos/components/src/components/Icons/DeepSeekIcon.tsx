import { Icon, TIconProps } from './Icon'
import { forwardRef } from 'react'

export const DeepSeekIcon = forwardRef((props: TIconProps, ref) => {
  return (
    <Icon
      title='deepseek'
      {...props}
      ref={ref}
      viewBox='0 0 24 24'
      d={
        'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15.5v-2.5H8.5v-2H11V10.5H8.5v-2H11V6h2v2.5h2.5v2H13v2.5h2.5v2H13v2.5h-2z'
      }
    />
  )
})
