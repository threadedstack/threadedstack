import { EPlatform } from '@TSH/types'

/**
 * Detects the current runtime platform
 * @returns EPlatform enum value
 */
export const detectPlatform = (): EPlatform => {
  // Check for browser environment
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return EPlatform.Browser
  }

  // Check for Bun runtime
  if (typeof process !== 'undefined' && process.versions?.bun) {
    return EPlatform.Bun
  }

  // Default to Node.js
  if (typeof process !== 'undefined' && process.versions?.node) {
    return EPlatform.Node
  }

  // Fallback to browser if neither Node nor Bun
  return EPlatform.Browser
}

/**
 * Checks if the current platform is browser-based
 * @returns true if running in browser
 */
export const isBrowser = (): boolean => {
  return detectPlatform() === EPlatform.Browser
}

/**
 * Checks if the current platform is Node.js
 * @returns true if running in Node.js
 */
export const isNode = (): boolean => {
  return detectPlatform() === EPlatform.Node
}

/**
 * Checks if the current platform is Bun
 * @returns true if running in Bun
 */
export const isBun = (): boolean => {
  return detectPlatform() === EPlatform.Bun
}

/**
 * Gets the default home directory based on platform
 * @param customDir - Custom directory override
 * @returns Resolved home directory path
 */
export const getHomeDir = (customDir?: string): string => {
  if (customDir) {
    return customDir
  }

  const platform = detectPlatform()

  if (platform === EPlatform.Browser) {
    return '/home'
  }

  // For Node/Bun, use current working directory or HOME env
  if (typeof process !== 'undefined') {
    return process.env.HOME || process.cwd()
  }

  return '/home'
}
