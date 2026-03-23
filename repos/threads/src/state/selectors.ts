import type { atomWithReset } from 'jotai/utils'

import { useAtom } from 'jotai'
import { useResetAtom } from 'jotai/utils'
import { userState } from '@TTH/state/user'
import { themeTypeState } from '@TTH/state/theme'
import { sidebarOpenState } from '@TTH/state/app'

const useRecState = <T = any>(state: ReturnType<typeof atomWithReset<T>>) => {
  const [current, setCurrent] = useAtom(state)
  const resetCurrent = useResetAtom(state)

  return [current, setCurrent, resetCurrent] as [
    T,
    typeof setCurrent,
    typeof resetCurrent,
  ]
}

export const useUser = () => useRecState(userState)
export const useThemeType = () => useRecState(themeTypeState)
export const useSidebarOpen = () => useRecState(sidebarOpenState)
