export type TOnToken = (token: string) => void

export type TToolDefinition = {
  type: `function`
  function: {
    name: string
    description: string
    parameters: {
      type: `object`
      properties: Record<string, any>
      required: string[]
    }
  }
}

export type TToolDefGroup = Record<string, TToolDefinition>

export type TToolCall = {
  id: string
  type: `function`
  function: {
    name: string
    arguments: string
  }
}

export type TToolResult = {
  tool_call_id: string
  output: string
  error?: string
}
