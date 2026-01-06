import type React from 'react'

import { forwardRef } from 'react'
import type { LinkProps as MLinkProps } from '@mui/material'
import { Link as MLink, } from '@mui/material'
import type { LinkProps as RRLinkProps } from 'react-router'
import { Link as RRLink, } from 'react-router'
type LinkProps = {
  children: React.ReactNode
} & RRLinkProps &
  MLinkProps

export const Link = forwardRef(({ children, ...rest }: LinkProps, ref): JSX.Element => {
  return (
    <MLink
      ref={ref}
      component={RRLink}
      {...rest}
    >
      {children}
    </MLink>
  )
})

export default Link
