import { makeTheme } from '@tdsk/components'
import { useThemeType } from '@TAF/state/selectors'

export const useMakeTheme = () => {
  const [type] = useThemeType()
  return makeTheme(type)
}
