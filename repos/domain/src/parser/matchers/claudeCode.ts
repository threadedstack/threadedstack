import type { TPatternMatcher, TParsedEvent } from '@TDM/types'
import {
  CCDiffAddRegEx,
  CCToolCallRegEx,
  CCDiffRemoveRegEx,
  CCErrorCrossRegEx,
  CCErrorPrefixRegEx,
  CCPermissionYNRegEx,
  CCPromptPatternRegEx,
  CCPermissionProceedRegEx,
} from '@TDM/constants/parser'

const now = () => Date.now()

export const claudeCodeMatchers: TPatternMatcher[] = [
  {
    name: `tool-call`,
    match(text: string): TParsedEvent | null {
      const m = text.match(CCToolCallRegEx)
      if (!m) return null
      return {
        type: `tool-call`,
        tool: m[1],
        target: m[2],
        status: `running`,
        timestamp: now(),
      }
    },
  },
  {
    name: `permission`,
    match(text: string): TParsedEvent | null {
      const m = text.match(CCPermissionYNRegEx) || text.match(CCPermissionProceedRegEx)
      if (!m) return null
      return { type: `permission`, prompt: text, command: m[1], timestamp: now() }
    },
  },
  {
    name: `error`,
    match(text: string): TParsedEvent | null {
      const m = text.match(CCErrorPrefixRegEx) || text.match(CCErrorCrossRegEx)
      if (!m) return null
      return { type: `error`, message: m[1] || text, timestamp: now() }
    },
  },
  {
    name: `prompt-ready`,
    match(text: string): TParsedEvent | null {
      if (!CCPromptPatternRegEx.test(text)) return null
      return { type: `prompt-ready`, timestamp: now() }
    },
  },
  {
    name: `diff`,
    match(text: string): TParsedEvent | null {
      const addMatch = text.match(CCDiffAddRegEx)
      if (addMatch)
        return {
          type: `diff`,
          file: ``,
          additions: [addMatch[1]],
          removals: [],
          timestamp: now(),
        }
      const removeMatch = text.match(CCDiffRemoveRegEx)
      if (removeMatch)
        return {
          type: `diff`,
          file: ``,
          additions: [],
          removals: [removeMatch[1]],
          timestamp: now(),
        }
      return null
    },
  },
]
