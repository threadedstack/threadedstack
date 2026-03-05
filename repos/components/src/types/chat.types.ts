import type { TMsgType, TArtifactType, TFileAttachment } from '@tdsk/domain'

export type TChatToolCall = {
  id: string
  name: string
  args: string
  result?: string
  isError?: boolean
}

export type TChatArtifact = {
  artifactType: TArtifactType
  content: string
  title?: string
  language?: string
}

export type TChatMessage = {
  id: string
  text: string
  role: TMsgType
  timestamp: number
  toolCalls?: TChatToolCall[]
  artifacts?: TChatArtifact[]
  files?: TFileAttachment[]
}

export type TPendingFile = {
  file: File
  id: string
}
