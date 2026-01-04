import React from 'react'

import { forwardRef } from 'react'
import { Link as MLink, LinkProps as MLinkProps } from '@mui/material'
import { Link as RRLink, LinkProps as RRLinkProps } from 'react-router'
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
