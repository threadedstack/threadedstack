/**
 * Calculate compute units from function calls and runtime.
 * Each function call = 1 unit. Each 10-second chunk of runtime = 1 unit.
 * Runtime is rounded up to the nearest 10-second boundary.
 */
export const computeUnits = (functionCalls: number, runtimeMs: number): number => {
  const runtimeChunks = Math.ceil(runtimeMs / 10_000)
  return functionCalls + runtimeChunks
}
