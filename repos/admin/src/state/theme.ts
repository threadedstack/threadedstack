import { EThemeType } from '@TAF/types'
import { atomWithReset } from 'jotai/utils'
import { storage } from '@TAF/services/storage'

export const defThemeType = storage.getThemeType() || EThemeType.light
export const themeTypeState = atomWithReset<EThemeType>(defThemeType)

