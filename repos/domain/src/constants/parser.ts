export const VTCellSize = 16

// Claude Code matcher patterns — used by matchers/claudeCode.ts

// Diff patterns (line starts with +/- and has content after)
export const CCDiffAddRegEx = /^\+\s+(.+)/
export const CCDiffRemoveRegEx = /^-\s+(.+)/

// Error patterns
export const CCErrorCrossRegEx = /^✗\s+(.+)/
export const CCErrorPrefixRegEx = /^Error:\s+(.+)/

// Prompt patterns
export const CCPromptPatternRegEx = /^[>$❯]\s*$/

// Permission prompts
export const CCPermissionProceedRegEx = /Do you want to proceed\?\s*\(y\/n\)/i
export const CCPermissionYNRegEx = /(?:Allow|Do you want to)\s+(.+?)\s*\?\s*\(y\/n\)/i

// ⏺ ToolName target
export const CCToolCallRegEx =
  /^⏺\s+(Read|Edit|Write|Bash|Glob|Grep|Agent|TodoWrite|WebFetch|WebSearch)\s+(.+)$/
