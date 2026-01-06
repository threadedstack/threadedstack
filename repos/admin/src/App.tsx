import { Routes } from '@TAF/routes/Routes'
import { RouterProvider } from 'react-router/dom'
import { useWindowResize } from '@tdsk/components'
import { GlobalStyles as MGS } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { GlobalStyles } from '@TAF/theme/GlobalStyles'
import { useMakeTheme } from '@TAF/hooks/theme/useMakeTheme'

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
      <RouterProvider router={Routes} />
    </ThemeProvider>
  )
}

export default App
