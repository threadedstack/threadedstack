import type { TReplConfig } from '@TRL/types'

import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { yellow } from '@TRL/display/colors'

const configDir = join(homedir(), `.config`, `tdsk`)
const configPath = join(configDir, `repl.json`)

export const loadConfig = (): TReplConfig | undefined => {
  try {
    if (!existsSync(configPath)) return undefined
    return JSON.parse(readFileSync(configPath, `utf-8`))
  } catch (err) {
    const msg = err instanceof Error ? err.message : `unknown error`
    process.stderr.write(
      `${yellow(`Warning:`)} Failed to load config from ${configPath}: ${msg}\n`
    )
    return undefined
  }
}

export const saveConfig = (config: TReplConfig): void => {
  try {
    mkdirSync(configDir, { recursive: true })
    writeFileSync(configPath, JSON.stringify(config, null, 2))
  } catch {
    // Config is optional — silently ignore write failures
  }
}
