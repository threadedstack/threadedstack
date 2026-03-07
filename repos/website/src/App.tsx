import { router } from '@TAF/router'
import { RouterProvider } from 'react-router/dom'
import { useWindowResize } from '@tdsk/components'
import { GlobalStyles as MGS } from '@mui/material'
import CssBaseline from '@mui/material/CssBaseline'
import { HelmetProvider } from 'react-helmet-async'
import { ThemeProvider } from '@mui/material/styles'
import { GlobalStyles } from '@TAF/theme/GlobalStyles'
import { useMakeTheme } from '@TAF/hooks/useMakeTheme'

const App = () => {
  useWindowResize()
  const theme = useMakeTheme()

  return (
    <HelmetProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles />
        <MGS
          styles={{
            body: {
              color: theme.palette.text.primary,
              backgroundColor: theme.palette.background.default,
            },
          }}
        />
        <RouterProvider router={router} />
      </ThemeProvider>
    </HelmetProvider>
  )
}

export default App
