export type TCellData = {
  codepoint: number
  raw: [number, number, number]
}

export type TTextSegment = {
  text: string
  bold: boolean
  italic: boolean
}

export type TToolName =
  | 'Read'
  | 'Edit'
  | 'Write'
  | 'Bash'
  | 'Glob'
  | 'Grep'
  | 'Agent'
  | 'TodoWrite'
  | 'WebFetch'
  | 'WebSearch'
  | (string & {})

export enum EParserEvtType {
  Input = `input`,
  Text = `text`,
  ToolCall = `tool-call`,
  Permission = `permission`,
  Diff = `diff`,
  Error = `error`,
  Activity = `activity`,
  PromptReady = `prompt-ready`,
  Unknown = `unknown`,
}

export type TParserEvtType = `${EParserEvtType}`

export enum EToolCallState {
  Running = `running`,
  Done = `done`,
}

export type TToolCallState = `${EToolCallState}`

export type TParsedEvent =
  | {
      type: `${EParserEvtType.Input}`
      content: string
      userId: string
      timestamp: number
    }
  | { type: `${EParserEvtType.Text}`; content: string; timestamp: number }
  | {
      type: `${EParserEvtType.ToolCall}`
      tool: TToolName
      target: string
      status: TToolCallState
      detail?: string
      timestamp: number
    }
  | {
      type: `${EParserEvtType.Permission}`
      prompt: string
      command?: string
      timestamp: number
    }
  | {
      type: `${EParserEvtType.Diff}`
      file: string
      additions: string[]
      removals: string[]
      timestamp: number
    }
  | { type: `${EParserEvtType.Error}`; message: string; timestamp: number }
  | { type: `${EParserEvtType.Activity}`; timestamp: number }
  | { type: `${EParserEvtType.PromptReady}`; timestamp: number }
  | { type: `${EParserEvtType.Unknown}`; raw: string; timestamp: number }
