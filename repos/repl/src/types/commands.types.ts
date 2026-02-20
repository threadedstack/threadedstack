export type TSlashCommandContext = {
  orgId: string
  agentId: string
  verbose: boolean
  exit: () => void
  threadId: string | null
  output: (text: string) => void
  setAgentId: (id: string) => void
  setVerbose: (v: boolean) => void
  setProviderId: (id: string) => void
  addContextFile: (path: string) => void
  setThreadId: (id: string | null) => void
  removeContextFile: (index: number) => void
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
