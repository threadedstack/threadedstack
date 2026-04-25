import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material'

import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'
import { useTheme } from '@TSC/hooks/theme/useTheme'

export type TPage = {
  sx?: SxProps<Theme>
  className?: string
  children?: ReactNode
}

const Container = styled(Box)`
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
`

const Main = styled(Box)(({ theme }) => {
  return `
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: ${theme.gutter.dpx};
    background-color: ${theme.palette.background.default};
  `
})

export const Page = (props: TPage) => {
  const { sx, children, className } = props

  const theme = useTheme()

  return (
    <Container className='tdsk-page-box'>
      <Main
        // @ts-ignore
        component='main'
        className={className}
        sx={[
          {
            transition: theme.transitions.create(`margin`, {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        {children}
      </Main>
    </Container>
  )
}
