import type { TTsaConfig } from '@TSA/types'
import { ConfigService } from '@TSA/services/config'

export const loadConfig = (): TTsaConfig | undefined => {
  try {
    const global = ConfigService.loadGlobal()
    const project = ConfigService.loadProject()
    return ConfigService.merge(global, project)
  } catch {
    return undefined
  }
}
