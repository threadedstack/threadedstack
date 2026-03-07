import { useAtom } from 'jotai'
import { makeTheme } from '@tdsk/components'
import { themeTypeAtom } from '@TAF/state/theme'

export const useMakeTheme = () => {
  const [type] = useAtom(themeTypeAtom)
  return makeTheme({ type })
}
