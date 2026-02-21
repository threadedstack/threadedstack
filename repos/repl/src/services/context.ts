import type { TContextFile } from '@TRL/types'

import { join, basename } from 'node:path'
import { AgentsFile, ContextDir } from '@TRL/constants/paths'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'

export class ContextLoader {
  static autoDetect(cwd: string): TContextFile[] {
    const files: TContextFile[] = []

    // Check for AGENTS.md
    const agentsPath = join(cwd, AgentsFile)
    if (existsSync(agentsPath)) {
      const content = readFileSync(agentsPath, 'utf-8')
      const stat = statSync(agentsPath)
      files.push({
        path: agentsPath,
        name: AgentsFile,
        source: 'auto',
        content,
        sizeBytes: stat.size,
      })
    }

    // Scan .tdsk/context/ directory
    const contextDir = join(cwd, ContextDir)
    if (existsSync(contextDir)) {
      const entries = readdirSync(contextDir)
      for (const entry of entries) {
        const filePath = join(contextDir, String(entry))
        const stat = statSync(filePath)
        if (stat.isFile()) {
          files.push({
            path: filePath,
            name: String(entry),
            source: 'auto',
            content: readFileSync(filePath, 'utf-8'),
            sizeBytes: stat.size,
          })
        }
      }
    }

    return files
  }

  static loadFile(path: string): TContextFile | null {
    if (!existsSync(path)) return null
    const stat = statSync(path)
    if (!stat.isFile()) return null
    return {
      path,
      name: basename(path),
      source: 'manual',
      content: readFileSync(path, 'utf-8'),
      sizeBytes: stat.size,
    }
  }
}
