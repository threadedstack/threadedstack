/**
 * Generate a unique resource name safe for parallel test execution.
 *
 * Combines a descriptive prefix, millisecond timestamp, and random suffix
 * to guarantee uniqueness even when multiple test workers start simultaneously.
 *
 * Example: "FaaS Test Project 1708900000000-a3f2"
 */
export const uniqueName = (prefix: string): string => {
  const ts = Date.now()
  const rand = Math.random().toString(16).slice(2, 6)
  return `${prefix} ${ts}-${rand}`
}
