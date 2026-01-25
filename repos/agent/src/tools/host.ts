/** @module tools */

import type { TSandboxMetadata } from '@TAG/types'

export class HostTools {
  #tools: Map<string, TSandboxMetadata>

  constructor() {
    this.#tools = new Map()
  }

  /**
   * Register a custom tool with the executor
   *
   * @param tool - Tool metadata including code and parameters
   * @throws Error if tool name is already registered
   */
  add(tool: TSandboxMetadata): void {
    if (this.#tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`)
    }

    // Validate tool structure
    if (!tool.name || !tool.description || !tool.code || !tool.parameters)
      throw new Error(`Tool must have name, description, code, and parameters`)

    if (tool.language !== `javascript`)
      throw new Error(`Only JavaScript tools are currently supported`)

    this.#tools.set(tool.name, tool)
  }

  /**
   * Unregister a custom tool
   *
   * @param name - Tool name to unregister
   * @returns true if tool was removed, false if not found
   */
  remove(name: string): boolean {
    return this.#tools.delete(name)
  }

  /**
   * Get a registered tool by name
   *
   * @param name - Tool name
   * @returns Tool metadata or undefined if not found
   */
  get(name: string): TSandboxMetadata | undefined {
    return this.#tools.get(name)
  }

  /**
   * Get all registered tool names
   *
   * @returns Array of registered tool names
   */
  list(): string[] {
    return Array.from(this.#tools.keys())
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.#tools.clear()
  }
}
