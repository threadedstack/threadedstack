import type { TContextFile } from '@TRL/types'

import { join, basename } from 'node:path'
import { AgentsFile, ContextDir } from '@TRL/constants/paths'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'

export class ContextLoader {
  static #readFile(
    filePath: string,
    name: string,
    source: TContextFile['source']
  ): TContextFile | null {
    if (!existsSync(filePath)) return null
    const stat = statSync(filePath)
    if (!stat.isFile()) return null
    return {
      name,
      source,
      path: filePath,
      sizeBytes: stat.size,
      content: readFileSync(filePath, 'utf-8'),
    }
  }

  static autoDetect(cwd: string): TContextFile[] {
    const files: TContextFile[] = []

    const agentsFile = ContextLoader.#readFile(join(cwd, AgentsFile), AgentsFile, 'auto')
    if (agentsFile) files.push(agentsFile)

    const contextDir = join(cwd, ContextDir)
    if (existsSync(contextDir)) {
      for (const entry of readdirSync(contextDir)) {
        const file = ContextLoader.#readFile(join(contextDir, entry), entry, 'auto')
        if (file) files.push(file)
      }
    }

    return files
  }

  static loadFile(path: string): TContextFile | null {
    return ContextLoader.#readFile(path, basename(path), 'manual')
  }
}
