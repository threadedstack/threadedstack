export type TAuthCredentials = {
  apiKey: string
  proxyUrl: string
  insecure?: boolean
}

export type TCliArgs = {
  command: string
  args: string[]
  flags: Record<string, string | boolean>
}

export type TToolCallAccumulator = {
  id: string
  name: string
  args: string
  result?: string
  isError?: boolean
}
