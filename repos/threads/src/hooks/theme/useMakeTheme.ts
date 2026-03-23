import { makeTheme } from '@tdsk/components'
import { useThemeType } from '@TTH/state/selectors'

export const useMakeTheme = () => {
  const [type] = useThemeType()
  return makeTheme({ type })
}
