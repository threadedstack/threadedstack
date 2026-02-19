export type TSlashCommandContext = {
  orgId: string
  agentId: string
  threadId: string | null
  setThreadId: (id: string | null) => void
  setAgentId: (id: string) => void
  setProviderId: (id: string) => void
  addContextFile: (path: string) => void
  removeContextFile: (index: number) => void
  setVerbose: (v: boolean) => void
  verbose: boolean
  exit: () => void
}

export type TSlashCommand = {
  name: string
  aliases: string[]
  description: string
  handler: (args: string, ctx: TSlashCommandContext) => Promise<string | void>
}
