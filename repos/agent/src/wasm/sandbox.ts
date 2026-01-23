/**
 * Tool Sandbox - WASM Guest
 *
 * This module is compiled into a WASM component that executes
 * user-supplied custom tool code in complete isolation.
 *
 * Security Features:
 * - No filesystem access
 * - No network access
 * - No access to Host process
 * - Timeout enforced externally by Host
 * - Memory limited by WASM instance configuration
 *
 * Architecture:
 * 1. Host calls execute-code with JS code and arguments
 * 2. Guest evaluates code in isolated context
 * 3. Guest calls toolFunction with parsed arguments
 * 4. Guest returns JSON string or throws error
 *
 * IMPORTANT: Throws errors instead of returning Result type
 */

/**
 * Execute user-supplied JavaScript code in isolation
 *
 * Expected code format (must be synchronous):
 * ```javascript
 * function toolFunction(args) {
 *   // User code here
 *   return JSON.stringify(result);
 * }
 * ```
 *
 * @param code - JavaScript source code containing toolFunction
 * @param argsJson - JSON-stringified arguments object
 * @returns JSON-stringified result
 * @throws Error with JSON error details on failure
 */
export function executeCode(code: string, argsJson: string): string {
  // Parse arguments
  let args: any
  try {
    args = JSON.parse(argsJson)
  } catch (error) {
    throw new Error(
      JSON.stringify({
        error: 'Invalid arguments JSON',
        details: error instanceof Error ? error.message : String(error),
      })
    )
  }

  // Create isolated execution context
  // The code must define and return a toolFunction
  let toolFunction: (args: any) => any

  try {
    // Use Function constructor to evaluate user code in isolation
    // The code should define toolFunction and make it available
    // We wrap it to return the toolFunction
    const wrappedCode = `
      ${code}
      return toolFunction;
    `
    // eslint-disable-next-line no-new-func
    const factory = new Function(wrappedCode)
    toolFunction = factory()

    // Check if toolFunction was defined
    if (typeof toolFunction !== 'function') {
      throw new Error(
        JSON.stringify({
          error: 'Code evaluation failed',
          details: 'Code must define a toolFunction',
        })
      )
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('{')) {
      throw error // Re-throw JSON errors
    }
    throw new Error(
      JSON.stringify({
        error: 'Code evaluation failed',
        details: error instanceof Error ? error.message : String(error),
      })
    )
  }

  // Execute the tool function
  const result = toolFunction(args)

  // Handle both sync and async functions
  // If result is a Promise, we reject it for now
  if (result && typeof result.then === 'function') {
    throw new Error(
      JSON.stringify({
        error: 'Tool execution failed',
        details:
          'Async tool functions are not yet supported. Please make your toolFunction synchronous.',
      })
    )
  }

  // Ensure result is a string (should be JSON)
  const resultStr = typeof result === 'string' ? result : JSON.stringify(result)

  // Validate it's valid JSON
  try {
    JSON.parse(resultStr)
  } catch {
    throw new Error(
      JSON.stringify({
        error: 'Tool execution failed',
        details: 'toolFunction must return valid JSON',
      })
    )
  }

  return resultStr
}
