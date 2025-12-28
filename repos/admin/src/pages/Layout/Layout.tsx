import { Toaster } from 'sonner'
import { Outlet } from 'react-router'
import { Loading } from '@tdsk/components'
import { useTheme } from '@mui/material/styles'
import { LayoutContainer, LayoutContent } from '@TAF/pages/Layout/Layout.styles'

const Layout = (props: any) => {
  const theme = useTheme()

  return (
    <LayoutContainer className='tdsk-layout-container' >
      <Toaster
        richColors
        closeButton
        position='bottom-left'
        className='tdsk-toast'
        theme={theme.palette.mode}
        toastOptions={{
          style: {
            color: theme.palette.text.primary,
            fontFamily: theme.typography.fontFamily,
            background: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      />
      
      <LayoutContent className='tdsk-page-content'>
        {(!loading || session)
          ? (
              <>
                <Outlet />
                {props?.children}
              </>
            )
          : (<Loading fixed full />)
        }
      </LayoutContent>
    </LayoutContainer>
  )
}

export default Layout
