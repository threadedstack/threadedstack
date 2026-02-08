import { camelCase } from '@keg-hub/jsutils'

export type TParseWitResult = {
  name: string
  exports: string[]
  imports: string[]
} | null

/**
 * Simple WIT file parser to extract world exports
 *
 * This is a minimal parser that extracts:
 * - World name
 * - Exported function names (converted to camelCase)
 * - Import interface names
 *
 * @param witContent - Content of the .wit file
 * @returns Parsed world info or null if not found
 */
export const parseWit = (witContent: string): TParseWitResult => {
  try {
    const worldRegex = /world\s+(\w+)\s*\{([^}]+)\}/s
    const worldMatch = witContent.match(worldRegex)

    if (!worldMatch) return null

    const worldName = worldMatch[1]
    const worldBody = worldMatch[2]

    // Extract exports
    // Matches: export <name>: func(...)
    const exportRegex = /export\s+([\w-]+)\s*:/g
    const exports: string[] = []
    let exportMatch

    while ((exportMatch = exportRegex.exec(worldBody)) !== null) {
      // Convert kebab-case to camelCase
      const exportName = camelCase(exportMatch[1])
      exports.push(exportName)
    }

    // Extract import interfaces
    // Matches: import <interface-name>;
    const importRegex = /import\s+([\w-]+)\s*;/g
    const imports = new Set<string>()
    let importMatch

    while ((importMatch = importRegex.exec(worldBody)) !== null) {
      imports.add(importMatch[1])
    }

    return {
      exports,
      name: worldName,
      imports: Array.from(imports),
    }
  } catch (error) {
    console.warn(`[WARN] Failed to parse WIT content:`, error)
    return null
  }
}
