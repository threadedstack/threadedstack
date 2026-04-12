export type TParsedEvent =
  | { type: `text`; content: string; timestamp: number }
  | { type: `input`; content: string; timestamp: number }
  | {
      type: `tool-call`
      tool: string
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
  | { type: `thinking`; timestamp: number }
  | { type: `prompt-ready`; timestamp: number }
  | { type: `unknown`; raw: string; timestamp: number }

export type TToolState = `idle` | `prompt` | `working` | `permission` | `interactive`

export type TSegmenterState = `outputting` | `waiting` | `interactive`

export type TBlock = {
  type: `input` | `output`
  content: string
  timestamp: number
}

export type TPatternMatcher = {
  name: string
  match: (text: string) => TParsedEvent | null
}

export type TTerminalParserOpts = {
  runtime: string
  onEvent: (event: TParsedEvent) => void
  onToolState: (state: TToolState) => void
  debounceMs?: number
  thinkingDelayMs?: number
}
