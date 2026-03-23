import { EThemeType } from '@TTH/types'
import { storage } from '@TTH/services/storage'
import { useThemeType } from '@TTH/state/selectors'

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
