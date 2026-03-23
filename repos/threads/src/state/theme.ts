import { EThemeType } from '@TTH/types'
import { atomWithReset } from 'jotai/utils'
import { storage } from '@TTH/services/storage'

export const defThemeType = storage.getThemeType() || EThemeType.light
export const themeTypeState = atomWithReset<EThemeType>(defThemeType)
