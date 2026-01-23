export type TWasmBridgeOpts = {
  wasmPath?: string
  enableLogging?: boolean
}

export type TWasmImports = {
  onToken: (token: string) => void
  executeShell: (cmd: string, args: string[]) => string
  webSearch: (query: string) => string
}

export type TWasmExports = {
  processRequest: (prompt: string) => Promise<void>
}
