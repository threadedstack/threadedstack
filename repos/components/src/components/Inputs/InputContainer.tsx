import type { ComponentProps, ReactNode } from 'react'

import Box from '@mui/material/Box'
import styled from '@mui/material/styles/styled'

const Container = styled(Box)`
  flex: 1;
  display: flex;
  flex-direction: column;
`

export type TInputContainer = ComponentProps<typeof Box> & {
  children: ReactNode
  className?: string | string[]
}

export const InputContainer = (props: TInputContainer) => {
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
