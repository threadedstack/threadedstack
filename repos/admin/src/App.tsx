import { Router } from '@TAF/routes/Routes'
import { useWindowResize } from '@tdsk/components'
import { Version } from '@TAF/components/Version'
import { GlobalStyles as MGS } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { AnalyticsProvider } from '@tdsk/components'
import { GlobalStyles } from '@TAF/theme/GlobalStyles'
import { AuthProvider } from '@TAF/contexts/AuthProvider'
import { useMakeTheme } from '@TAF/hooks/theme/useMakeTheme'

const App = () => {
  useWindowResize()
  const theme = useMakeTheme()

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <AuthProvider>
        <AnalyticsProvider>
          <MGS
            styles={{
              body: {
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.background.default,
              },
            }}
          />
          <Router />
          <Version />
        </AnalyticsProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
