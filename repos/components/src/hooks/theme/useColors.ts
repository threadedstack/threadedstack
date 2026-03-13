import { colors } from '@TSC/theme'
import { useCallback } from 'react'
import { useIsDarkMode } from './useIsDarkMode'

const hashCode = (str: string) => {
  return str
    .split('')
    .reduce(
      (hash, val) => (hash = val.charCodeAt(0) + (hash << 6) + (hash << 16) - hash),
      0
    )
}

const darkColors = Object.values(colors.dark)
const lightColors = Object.values(colors.light)

export const useColors = (inverted?: boolean) => {
  const isDarkMode = useIsDarkMode()
  const useDark = inverted ? !isDarkMode : isDarkMode
  return useDark ? darkColors : lightColors
}

export const useColorForName = (uiName: string) => {
  const colors = useColors()

  return useCallback(
    (name: string, isUser?: boolean, isError?: boolean) => {
      if (isError) return `error.main`
      if (name === uiName) return `primary.main`
      if (isUser) return `text.primary`

      const index = Math.abs(hashCode(name)) % colors.length
      return colors[index]
    },
    [uiName]
  )
}
