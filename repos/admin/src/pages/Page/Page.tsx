import type { ReactNode, CSSProperties } from 'react'
import type { SxProps } from '@mui/material'


import { useState } from 'react'
import Box from '@mui/material/Box'
import { init } from '@TAF/actions/init'
import { ife } from '@keg-hub/jsutils/ife'
import { useTheme } from '@TSC/hooks/theme/useTheme'
import { Header } from '@TAF/components/Header/Header'
import { HeaderSettingsItems } from '@TAF/constants/nav'
import { Loading, useEffectOnce, dims } from '@tdsk/components'



export type TPage = {
  sx?:SxProps|CSSProperties
  className?:string
  children?:ReactNode
}

const defs = {
  page: {
    sx: {
      flexGrow: 1,
      width: `100%`,
      height: `100%`,
    }
  },
  loading: {
    full: true,
    message: `Loading dashboard...`,
    messageSx: { color: `text.primary` },
  },
  main: {
    sx: {
      p: 5,
      flexGrow: 1,
      overflow: `auto`,
      bgcolor: `background.default`,
      height: `calc( 100vh - ${dims.header.hpx})`,
    }
  }
  
}

export const Page = (props:TPage) => {
  const {
    sx,
    children,
    className,
  } = props

  const theme = useTheme()
  const [ready, setReady] = useState<boolean>(false)

  useEffectOnce(() => {
    ife(async () => {
      await init()
      setReady(true)
    })
  })

  return (
    <Box
      sx={defs.page.sx}
      className='tdsk-page-box'
    >
      {
        !ready
          ? (<Loading {...defs.loading} />)
          : (
              <>
                <Header navItems={HeaderSettingsItems} />
                <Box
                  component="main"
                  className={className}
                  sx={[defs.main.sx, {
                    transition: theme.transitions.create(`margin`, {
                      easing: theme.transitions.easing.sharp,
                      duration: theme.transitions.duration.leavingScreen,
                    }),
                  }, sx] as CSSProperties[]}
                >
                  {children}
                </Box>
              </>
            )
      }
    
    </Box>
  )
}