import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material'

import { useState } from 'react'
import Box from '@mui/material/Box'
import { init } from '@TTH/actions/init'
import { ife } from '@keg-hub/jsutils/ife'
import { styled } from '@mui/material/styles'
import { useTheme } from '@TSC/hooks/theme/useTheme'
import { Loading, useEffectOnce } from '@tdsk/components'

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
  const [ready, setReady] = useState<boolean>(false)

  useEffectOnce(() => {
    ife(async () => {
      await init()
      setReady(true)
    })
  })

  return (
    <Container className='tdsk-page-box'>
      {!ready ? (
        <Loading
          full
          message='Loading...'
          messageSx={{ color: `text.primary` }}
        />
      ) : (
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
      )}
    </Container>
  )
}
