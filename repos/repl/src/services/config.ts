import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import yaml from 'js-yaml'
import type { TReplConfig, TProjectConfig } from '@TRL/types'
import { CONFIG_PATH, CONFIG_DIR, PROJECT_CONFIG } from '@TRL/constants'

export class ConfigService {
  static loadGlobal(): TReplConfig {
    if (!existsSync(CONFIG_PATH)) return {}
    try {
      const content = readFileSync(CONFIG_PATH, 'utf-8')
      return (yaml.load(content) as TReplConfig) || {}
    } catch {
      return {}
    }
  }

  static saveGlobal(config: TReplConfig): void {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
    const content = yaml.dump(config, { sortKeys: true, lineWidth: 120 })
    writeFileSync(CONFIG_PATH, content, 'utf-8')
    chmodSync(CONFIG_PATH, 0o600)
  }

  static loadProject(cwd?: string): TProjectConfig {
    const configPath = join(cwd || process.cwd(), PROJECT_CONFIG)
    if (!existsSync(configPath)) return {}
    try {
      const content = readFileSync(configPath, 'utf-8')
      return (yaml.load(content) as TProjectConfig) || {}
    } catch {
      return {}
    }
  }

  static merge(global: TReplConfig, project: TProjectConfig): TReplConfig {
    return {
      ...global,
      ...(project.org && { org: project.org }),
      ...(project.agent && { agent: project.agent }),
      hooks: { ...global.hooks, ...project.hooks },
      tools: {
        confirm: [...(global.tools?.confirm || []), ...(project.tools?.confirm || [])],
        block: [...(global.tools?.block || []), ...(project.tools?.block || [])],
      },
    }
  }
}
