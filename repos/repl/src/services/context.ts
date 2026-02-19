import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import type { TContextFile } from '@TRL/types'
import { AGENTS_FILE, CONTEXT_DIR } from '@TRL/constants'

export class ContextLoader {
  static autoDetect(cwd: string): TContextFile[] {
    const files: TContextFile[] = []

    // Check for AGENTS.md
    const agentsPath = join(cwd, AGENTS_FILE)
    if (existsSync(agentsPath)) {
      const content = readFileSync(agentsPath, 'utf-8')
      const stat = statSync(agentsPath)
      files.push({
        path: agentsPath,
        name: AGENTS_FILE,
        source: 'auto',
        content,
        sizeBytes: stat.size,
      })
    }

    // Scan .tdsk/context/ directory
    const contextDir = join(cwd, CONTEXT_DIR)
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
