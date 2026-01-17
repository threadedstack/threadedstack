import { useMemo } from 'react'
import { get } from '@keg-hub/jsutils/get'
import { isStr } from '@keg-hub/jsutils/isStr'
import { useTheme } from '@TSC/hooks/theme/useTheme'
import { CSSColorGlobals, CSSMuiColors } from '@TSC/constants/values'

const colorKWs = [...CSSColorGlobals, ...CSSMuiColors]

export const useColor = (color: string) => {
  const theme = useTheme()
  return useMemo(() => {
    if (!color) return undefined

    if (Object.keys(theme.palette.colors).includes(color))
      return theme.palette.colors[color]

    if (colorKWs.includes(color)) return color

    const named = get(theme.palette.colors, color, undefined)
    if (named) return named

    const direct = get(theme.palette.colors, color, undefined)
    return isStr(direct) ? direct : color
  }, [theme, color])
}
