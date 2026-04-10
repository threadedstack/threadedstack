import type { TSelectItem } from '@TSA/types'

export type TSlashCommandContext = {
  orgId: string
  agentId: string
  verbose: boolean
  exit: () => void
  connection: string
  threadId: string | null
  projectId: string | null
  clearMessages: () => void
  output: (text: string) => void
  setAgentId: (id: string) => void
  setVerbose: (v: boolean) => void
  setProviderId: (id: string) => void
  setProjectId: (id: string) => void
  addContextFile: (path: string) => void
  setThreadId: (id: string | null) => void
  removeContextFile: (index: number) => void
  deleteThread: (threadId: string) => Promise<void>
  messages: Array<{ type: string; content: string }>
  loadThreadMessages: (threadId: string) => Promise<void>
  createThread: (name?: string) => Promise<{ id: string; name?: string }>
  listThreads: () => Promise<Array<{ id: string; name?: string; createdAt?: string }>>
  getThreadWithBranches: (threadId: string) => Promise<{
    id: string
    name?: string
    parentThreadId?: string
    branches?: Array<{ id: string; name?: string; branchMessageId?: string }>
    parentThread?: { id: string; name?: string }
  }>
  branchThread: (
    threadId: string,
    messageId: string
  ) => Promise<{ id: string; name?: string }>
  switchProject: () => Promise<void>
  listProjects: () => Promise<TSelectItem[]>
  listAgents: () => Promise<TSelectItem[]>
  showMenu: (
    prompt: string,
    items: TSelectItem[],
    onSelect: (item: TSelectItem) => void,
    options?: {
      onAction?: (item: TSelectItem) => void
    }
  ) => void
  closeMenu: () => void
  contextFiles: Array<{ path: string; name: string; content: string; sizeBytes: number }>
  auth: {
    loggedIn: boolean
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
