export type TWasmBridgeOpts = {
  wasmPath?: string
  logging?: boolean
}

export type TWasmImports = {
  onToken: (token: string) => void
  executeShell: (cmd: string, args: string[]) => string | Promise<string>
  webSearch: (query: string) => string

  // Filesystem operations
  readFile: (path: string) => string | Promise<string>
  writeFile: (path: string, content: string) => string | Promise<string>
  listDirectory: (path: string) => string[] | Promise<string[]>
  deleteFile: (path: string) => string | Promise<string>
  createDirectory: (path: string) => string | Promise<string>
  fileExists: (path: string) => boolean | Promise<boolean>
  getFileStats: (path: string) => string | Promise<string>

  // Custom tool execution
  executeCustomTool: (toolName: string, argsJson: string) => string | Promise<string>

  vfsMounts?: Record<string, string> // guestPath -> hostPath
  config?: Record<string, string | number> // Environment variables for WASM
}

export type TWasmInstance = {
  exports: any
  imports: any
  prompt: (prompt: string) => void
}
