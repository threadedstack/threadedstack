export enum EToolStatus {
  error = `error`,
  success = `success`,
  running = `running`,
}

export type TToolStatus = `${EToolStatus}`

export type TToolCall = {
  name: string
  args: string
  summary: string
  result?: string
  status: TToolStatus
}
