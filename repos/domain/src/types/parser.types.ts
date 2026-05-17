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

export type TParsedEvent =
  | { type: `input`; content: string; userId: string; timestamp: number }
  | { type: `text`; content: string; timestamp: number }
  | {
      type: `tool-call`
      tool: TToolName
      target: string
      status: `running` | `done`
      detail?: string
      timestamp: number
    }
  | { type: `permission`; prompt: string; command?: string; timestamp: number }
  | {
      type: `diff`
      file: string
      additions: string[]
      removals: string[]
      timestamp: number
    }
  | { type: `error`; message: string; timestamp: number }
  | { type: `activity`; timestamp: number }
  | { type: `prompt-ready`; timestamp: number }
  | { type: `unknown`; raw: string; timestamp: number }
