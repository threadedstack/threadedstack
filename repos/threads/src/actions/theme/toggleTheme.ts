import { EThemeType } from '@TTH/types'
import { storage } from '@TTH/services/storage'
import { getThemeType, setThemeType } from '@TTH/state/accessors'

export const toggleTheme = (update?: EThemeType) => {
  const current = getThemeType()
  const next =
    update ?? (current === EThemeType.light ? EThemeType.dark : EThemeType.light)
  setThemeType(next)
  storage.setThemeType(next)
}
