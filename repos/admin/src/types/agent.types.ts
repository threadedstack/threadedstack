export enum EAgentThreadTab {
  assets = `assets`,
  threads = `threads`,
  messages = `messages`,
}

export type TAgentThreadTab = `${EAgentThreadTab}`

import type { TAgentEnvironment } from '@tdsk/domain'

export type TAgentSessionData = {
  model: string
  provider: string
  tools?: string[]
  sessionToken: string
  environment?: TAgentEnvironment
}
