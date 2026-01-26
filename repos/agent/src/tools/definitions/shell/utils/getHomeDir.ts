export const ShellHomDef = `/home`

/**
 * Gets the default home directory based on platform
 * @param customDir - Custom directory override
 * @returns Resolved home directory path
 */
export const getHomeDir = (override?: string): string => {
  if (override) return override

  if (typeof process !== `undefined`)
    return process.env.HOME || process.cwd() || ShellHomDef

  return ShellHomDef
}
