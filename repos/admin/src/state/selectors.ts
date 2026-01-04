import type { SetStateAction, WritableAtom } from 'jotai'

import { useResetAtom, RESET } from 'jotai/utils'

import { useAtom } from 'jotai'
import { sidebarOpenState } from '@TAF/state/app'
import { themeTypeState } from '@TAF/state/theme'

const useRecState = <T=any>(state:WritableAtom<T, [SetStateAction<T> | typeof RESET], void>) => {
  const [current, setCurrent] = useAtom(state)
  const resetCurrent = useResetAtom(state)

  return [current, setCurrent, resetCurrent] as [T, SetStateAction<T>, () => void]
}


export const useThemeType = () => useRecState(themeTypeState)
export const useSidebarOpen = () => useRecState(sidebarOpenState)


