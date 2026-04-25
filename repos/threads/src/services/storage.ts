import type { EThemeType } from '@TTH/types'

import { Storage as CStorage } from '@tdsk/components'
import {
  StorageKeyPrefix,
  ThemeTypeStorageKey,
  ApiHeadersStorageKey,
} from '@TTH/constants/storage'

export class Storage extends CStorage {
  #sandboxKey = (sandboxId: string) => `${StorageKeyPrefix}nav-sandbox-${sandboxId}`

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

  getSBExpanded = (sandboxId: string) => {
    const stored = this.get<string>(this.#sandboxKey(sandboxId))
    return stored === `true`
  }

  setSBExpanded = (sandboxId: string, next: boolean) => {
    this.set<string>(this.#sandboxKey(sandboxId), String(next))
  }
}

export const storage = new Storage()
