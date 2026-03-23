import type { EThemeType } from '@TTH/types'

import { Storage as CStorage } from '@tdsk/components'
import { ThemeTypeStorageKey, ApiHeadersStorageKey } from '@TTH/constants/storage'

export class Storage extends CStorage {
  getHeaders = (): Record<string, string> => {
    return this.get(ApiHeadersStorageKey)
  }

  setHeaders = (data: Record<string, string>) => {
    return this.set(ApiHeadersStorageKey, data)
  }

  removeHeaders = () => {
    return this.remove(ApiHeadersStorageKey)
  }

  getThemeType = () => {
    return this.get<EThemeType>(ThemeTypeStorageKey, false)
  }

  setThemeType = (theme: EThemeType) => {
    return this.set<EThemeType>(ThemeTypeStorageKey, theme, false)
  }

  removeThemeType = () => {
    return this.remove(ThemeTypeStorageKey)
  }
}

export const storage = new Storage()
