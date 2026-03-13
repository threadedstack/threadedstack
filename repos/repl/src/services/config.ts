import type { TReplConfig, TProjectConfig } from '@TRL/types'

import yaml from 'js-yaml'
import { join } from 'node:path'
import { ConfigPath, ConfigDir, ProjectConfig } from '@TRL/constants/paths'
import { chmodSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

export class ConfigService {
  static #loadYaml<T>(path: string): T | null {
    if (!existsSync(path)) return null
    try {
      const content = readFileSync(path, `utf-8`)
      return (yaml.load(content) as T) || null
    } catch (err: any) {
      console.warn(`Error loading config at "${path}"`, err?.message)
      return null
    }
  }

  static loadGlobal(): TReplConfig {
    return ConfigService.#loadYaml<TReplConfig>(ConfigPath) ?? {}
  }

  static saveGlobal(config: TReplConfig): void {
    mkdirSync(ConfigDir, { recursive: true, mode: 0o700 })
    const content = yaml.dump(config, { sortKeys: true, lineWidth: 120 })
    writeFileSync(ConfigPath, content, `utf-8`)
    chmodSync(ConfigPath, 0o600)
  }

  static loadProject(cwd?: string): TProjectConfig {
    return (
      ConfigService.#loadYaml<TProjectConfig>(
        join(cwd || process.cwd(), ProjectConfig)
      ) ?? {}
    )
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
