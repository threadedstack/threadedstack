export type TSlashCommandContext = {
  orgId: string
  agentId: string
  verbose: boolean
  exit: () => void
  threadId: string | null
  connection: string
  output: (text: string) => void
  setAgentId: (id: string) => void
  setVerbose: (v: boolean) => void
  setProviderId: (id: string) => void
  addContextFile: (path: string) => void
  setThreadId: (id: string | null) => void
  removeContextFile: (index: number) => void
  clearMessages: () => void
  messages: Array<{ type: string; content: string }>
  contextFiles: Array<{ path: string; name: string; content: string; sizeBytes: number }>
  listThreads: () => Promise<Array<{ id: string; name?: string; createdAt?: string }>>
  loadThreadMessages: (threadId: string) => Promise<void>
  auth: {
    isLoggedIn: boolean
    logout: () => void
    login: (apiKey: string, proxyUrl?: string, insecure?: boolean) => Promise<void>
  }
}

export type TSlashCommand = {
  name: string
  aliases: string[]
  description: string
  handler: (args: string, ctx: TSlashCommandContext) => Promise<string | void>
}
