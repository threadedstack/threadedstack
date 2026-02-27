import { Icon, TIconProps } from './Icon'
import { forwardRef } from 'react'

export const ZAIIcon = forwardRef((props: TIconProps, ref) => {
  return (
    <Icon
      title='zai'
      {...props}
      ref={ref}
      fill='none'
      viewBox='0 0 160 160'
    >
      <path d='M82.771 33.208L75.0661 44.157C74.4609 45.0175 73.6581 45.7202 72.7251 46.2063C71.7922 46.6924 70.7562 46.9476 69.7043 46.9506H27.7104V33.1629L82.771 33.208Z' />
      <path d='M135.083 33.2075L68.9835 126.837H24.917L91.0167 33.2075H135.083Z' />
      <path d='M77.2741 126.837L85.024 115.843C85.6316 114.988 86.4359 114.292 87.3692 113.814C88.3025 113.336 89.3372 113.089 90.3859 113.095H132.335V126.612L77.2741 126.837Z' />
    </Icon>
  )
})
