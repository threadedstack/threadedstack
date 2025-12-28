import useTheme from '@mui/material/styles/useTheme'

export const useIsDarkMode = (): boolean => {
  const theme = useTheme()
  return theme.palette.mode === `dark`
}
