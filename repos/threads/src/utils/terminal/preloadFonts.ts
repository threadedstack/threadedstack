import { FontLoadTimeoutMs } from '@TTH/constants/values'

function extractPrimaryFont(fontFamily: string): string | null {
  const first = fontFamily.split(',')[0]?.trim()
  if (!first) return null
  return first.replace(/^['"]|['"]$/g, '')
}

export async function preloadTerminalFont(
  fontFamily: string,
  fontSize: number
): Promise<void> {
  const name = extractPrimaryFont(fontFamily)
  if (!name || name === 'monospace') return

  try {
    const result = await Promise.race([
      document.fonts.load(`${fontSize}px "${name}"`),
      new Promise<FontFace[]>((resolve) =>
        setTimeout(() => {
          console.warn(
            `[preloadTerminalFont] Font "${name}" timed out after ${FontLoadTimeoutMs}ms`
          )
          resolve([])
        }, FontLoadTimeoutMs)
      ),
    ])
    if (result.length === 0) {
      console.warn(`[preloadTerminalFont] Font "${name}" not available, using fallback`)
    }
  } catch (err) {
    console.warn(`[preloadTerminalFont] Failed to load font "${name}"`, err)
  }
}
