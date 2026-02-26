import type { TAgentEnvironment } from '@tdsk/domain'

export enum EAgentThreadTab {
  assets = `assets`,
  threads = `threads`,
  messages = `messages`,
}

export type TAgentThreadTab = `${EAgentThreadTab}`

export enum EAgentDetailTab {
  agent = `agent`,
  threads = `threads`,
}

export type TAgentDetailTab = `${EAgentDetailTab}`

export type TAgentSessionData = {
  model: string
  provider: string
  tools?: string[]
  sessionToken: string
  environment?: TAgentEnvironment
}
