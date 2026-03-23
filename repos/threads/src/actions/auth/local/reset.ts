import { resetUser, resetThemeType, resetSidebarOpen } from '@TTH/state/accessors'

export const reset = () => {
  resetUser?.()
  resetThemeType?.()
  resetSidebarOpen?.()
}
