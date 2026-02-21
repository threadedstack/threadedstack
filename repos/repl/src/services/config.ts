import type { TReplConfig, TProjectConfig } from '@TRL/types'

import yaml from 'js-yaml'
import { join } from 'node:path'
import { ConfigPath, ConfigDir, ProjectConfig } from '@TRL/constants/paths'
import { chmodSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

export class ConfigService {
  static loadGlobal(): TReplConfig {
    if (!existsSync(ConfigPath)) return {}
    try {
      const content = readFileSync(ConfigPath, `utf-8`)
      return (yaml.load(content) as TReplConfig) || {}
    } catch {
      return {}
    }
  }

  static saveGlobal(config: TReplConfig): void {
    mkdirSync(ConfigDir, { recursive: true, mode: 0o700 })
    const content = yaml.dump(config, { sortKeys: true, lineWidth: 120 })
    writeFileSync(ConfigPath, content, `utf-8`)
    chmodSync(ConfigPath, 0o600)
  }

  static loadProject(cwd?: string): TProjectConfig {
    const configPath = join(cwd || process.cwd(), ProjectConfig)
    if (!existsSync(configPath)) return {}
    try {
      const content = readFileSync(configPath, `utf-8`)
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
