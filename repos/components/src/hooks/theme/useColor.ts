import { useMemo } from 'react'
import { get } from '@keg-hub/jsutils/get'
import { colors } from '@TSC/theme/colors'
import { isStr } from '@keg-hub/jsutils/isStr'
import { useTheme } from '@TSC/hooks/theme/useTheme'
import { CSSColorGlobals, CSSMuiColors } from '@TSC/constants/values'

const colorKWs = [...CSSColorGlobals, ...CSSMuiColors]
const colorStates = Object.keys(colors.states)

export const useColor = (color: string) => {
  const theme = useTheme()
  return useMemo(() => {
    if (!color) return undefined
    if (colorStates.includes(color)) return colors.states[color]
    if (colorKWs.includes(color)) return color

    const named = get(theme.palette.colors, color, undefined)
    if (named) return named

    const direct = get(colors, color, undefined)
    return isStr(direct) ? direct : color
  }, [theme, color])
}
