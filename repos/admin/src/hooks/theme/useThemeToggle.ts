import { EThemeType } from '@TAF/types'
import { storage } from '@TAF/services/storage'
import { useThemeType } from '@TAF/state/selectors'

export const useThemeToggle = () => {
  const [themeType, setThemeType] = useThemeType()

  const onThemeToggle = (update?:EThemeType) => {
    update = update || (themeType === EThemeType.light ? EThemeType.dark : EThemeType.light)
    setThemeType(update)
    storage.setThemeType(update)
  }
  
  return {
    themeType,
    onThemeToggle
  }

}
