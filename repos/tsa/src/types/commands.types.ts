import type { TSelectItem, TTokenLoginOpts } from '@TSA/types'

type TMessage = { type: string; content: string }
type TThread = { id: string; name?: string; createdAt?: string }
type TThreadBranch = { id: string; name?: string; branchMessageId?: string }
type TCtxFile = { path: string; name: string; content: string; sizeBytes: number }

type TMenuOnAction = (item: TSelectItem) => void

type TMenuOpts = {
  onAction?: TMenuOnAction
}

type TThreadWBranches = {
  id: string
  name?: string
  parentThread?: TThread
  parentThreadId?: string
  branches?: Array<TThreadBranch>
}

type TCmdCtxAuth = {
  loggedIn: boolean
  proxyUrl: string | null
  logout: () => Promise<void>
  loginWithToken: (opts: TTokenLoginOpts) => Promise<void>
  login: (apiKey: string, proxyUrl?: string, insecure?: boolean) => Promise<void>
}

export type TSlashCommandContext = {
  orgId: string
  agentId: string
  verbose: boolean
  exit: () => void
  auth: TCmdCtxAuth
  connection: string
  closeMenu: () => void
  threadId: string | null
  projectId: string | null
  clearMessages: () => void
  messages: Array<TMessage>
  contextFiles: Array<TCtxFile>
  output: (text: string) => void
  setAgentId: (id: string) => void
  setVerbose: (v: boolean) => void
  switchProject: () => Promise<void>
  setProviderId: (id: string) => void
  setProjectId: (id: string) => void
  addContextFile: (path: string) => void
  listAgents: () => Promise<TSelectItem[]>
  setThreadId: (id: string | null) => void
  listProjects: () => Promise<TSelectItem[]>
  removeContextFile: (index: number) => void
  listThreads: () => Promise<Array<TThread>>
  createThread: (name?: string) => Promise<TThread>
  deleteThread: (threadId: string) => Promise<void>
  loadThreadMessages: (threadId: string) => Promise<void>
  getThreadWithBranches: (threadId: string) => Promise<TThreadWBranches>
  branchThread: (threadId: string, messageId: string) => Promise<TThread>
  showMenu: (
    prompt: string,
    items: TSelectItem[],
    onSelect: TMenuOnAction,
    options?: TMenuOpts
  ) => void
}

export type TSlashCommand = {
  name: string
  aliases: string[]
  description: string
  handler: (args: string, ctx: TSlashCommandContext) => Promise<string | void>
}
