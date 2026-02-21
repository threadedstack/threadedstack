export enum EMessageType {
  user = `user`,
  error = `error`,
  system = `system`,
  assistant = `assistant`,
}

export type TMessageType = `${EMessageType}`

export type TMessage = {
  id: string
  type: string
  content: string
  toolCalls?: any[]
}
