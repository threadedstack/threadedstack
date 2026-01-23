export type TExecutorOpts = {
  timeout?: number
  allowedCommands?: Set<string>
  blockedPatterns?: RegExp[]
}
