import type { TReplConfig } from '@TRL/types'
import { ConfigService } from '@TRL/services/config'

export const loadConfig = (): TReplConfig | undefined => {
  try {
    const global = ConfigService.loadGlobal()
    const project = ConfigService.loadProject()
    return ConfigService.merge(global, project)
  } catch {
    return undefined
  }
}
