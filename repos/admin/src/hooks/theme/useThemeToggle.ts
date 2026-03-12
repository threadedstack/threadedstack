import { EThemeType } from '@TAF/types'
import { storage } from '@TAF/services/storage'
import { useThemeType } from '@TAF/state/selectors'

export const useThemeToggle = () => {
  const [themeType, setThemeType] = useThemeType()

  const onThemeToggle = (update?: EThemeType) => {
    const next =
      update ?? (themeType === EThemeType.light ? EThemeType.dark : EThemeType.light)
    setThemeType(next)
    storage.setThemeType(next)
  }

  return {
    themeType,
    onThemeToggle,
  }
}
