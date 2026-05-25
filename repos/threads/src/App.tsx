import { Toaster } from 'sonner'
import { Router } from '@TTH/routes/Routes'
import { useWindowResize } from '@tdsk/components'
import { GlobalStyles as MGS } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { GlobalStyles } from '@TTH/theme/GlobalStyles'
import { useMakeTheme } from '@TTH/hooks/theme/useMakeTheme'

const App = () => {
  useWindowResize()
  const theme = useMakeTheme()

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <MGS
        styles={{
          body: {
            color: theme.palette.text.primary,
            backgroundColor: theme.palette.background.default,
          },
        }}
      />
      <Toaster
        position='top-right'
        theme={theme.palette.mode === `dark` ? `dark` : `light`}
      />
      <Router />
    </ThemeProvider>
  )
}

export default App
