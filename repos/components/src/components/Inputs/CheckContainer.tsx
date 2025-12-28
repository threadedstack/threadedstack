import type { ComponentProps, ReactNode } from 'react'


import Box from '@mui/material/Box'
import styled from '@mui/material/styles/styled'

const Container = styled(Box)``

export type TInputContainer = ComponentProps<typeof Box> & {
  children: ReactNode
  className?: string | string[]
}

export const CheckContainer = (props: TInputContainer) => {
  const { children, className, ...rest } = props

  return (
    <Container
      className={className}
      {...rest}
    >
      {children}
    </Container>
  )
}
