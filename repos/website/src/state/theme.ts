import { atomWithStorage } from 'jotai/utils'

export type TThemeType = `light` | `dark`

export const themeTypeAtom = atomWithStorage<TThemeType>(`tdsk-web-theme`, `dark`)
