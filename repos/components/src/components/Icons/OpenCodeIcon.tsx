import { Icon, TIconProps } from './Icon'
import { forwardRef } from 'react'

//width='240' height='300'

export const OpenCodeIcon = forwardRef((props: TIconProps, ref) => {
  return (
    <Icon
      title='opencode'
      {...props}
      ref={ref}
      viewBox='0 0 240 300'
      attrs={{
        ...props.attrs,
      }}
    >
      <g clip-path='url(#clip0_1401_86274)'>
        <mask
          x='0'
          y='0'
          width='240'
          height='300'
          id='mask0_1401_86274'
          maskUnits='userSpaceOnUse'
          style={{ maskType: `luminance` }}
        >
          <path
            d='M240 0H0V300H240V0Z'
            fill='white'
          />
        </mask>
        <g mask='url(#mask0_1401_86274)'>
          <path
            d='M180 240H60V120H180V240Z'
            fill='#CFCECD'
          />
          <path d='M180 60H60V240H180V60ZM240 300H0V0H240V300Z' />
        </g>
      </g>
      <defs>
        <clipPath id='clip0_1401_86274'>
          <rect
            width='240'
            height='300'
            fill='white'
          />
        </clipPath>
      </defs>
    </Icon>
  )
})
