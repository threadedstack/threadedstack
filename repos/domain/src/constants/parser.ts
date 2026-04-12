// Matches ANSI escape sequences:
// - CSI sequences: ESC [ ... (params) ... (final byte)
// - OSC sequences: ESC ] ... (ST or BEL)
// - Simple escapes: ESC + single char
// - C1 control codes (0x80-0x9F range via \u009B)
export const AnsiRegEx =
  /[\u001B\u009B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nq-uy=><~]|\x1b\][^\x07]*\x07|\x1b[^[\]()#;?0-9A-ORZcf-nq-uy=><~]/g

export const PromptRegEx = /^[>$#] $/

// Diff patterns (only match if line starts with +/- and has content after)
export const CCDiffAddRegEx = /^\+\s+(.+)/
export const CCDiffRemoveRegEx = /^-\s+(.+)/

// Error patterns
export const CCErrorCrossRegEx = /^✗\s+(.+)/
export const CCErrorPrefixRegEx = /^Error:\s+(.+)/
// Prompt patterns
export const CCPromptPatternRegEx = /^[>$]\s*$/

// Permission prompts
export const CCPermissionProceedRegEx = /Do you want to proceed\?\s*\(y\/n\)/i
export const CCPermissionYNRegEx = /(?:Allow|Do you want to)\s+(.+?)\s*\?\s*\(y\/n\)/i

// ⏺ ToolName target
export const CCToolCallRegEx =
  /^⏺\s+(Read|Edit|Write|Bash|Glob|Grep|Agent|TodoWrite|WebFetch|WebSearch)\s+(.+)$/
