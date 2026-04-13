import type { TPatternMatcher } from '@TDM/types'
import { claudeCodeMatchers } from '@TDM/parser/matchers/claudeCode'

const matcherRegistry = new Map<string, TPatternMatcher[]>()

// Register built-in matchers
matcherRegistry.set(`claude-code`, claudeCodeMatchers)

export const getMatchers = (runtime: string): TPatternMatcher[] =>
  matcherRegistry.get(runtime) ?? []

export const registerMatchers = (runtime: string, matchers: TPatternMatcher[]) =>
  matcherRegistry.set(runtime, matchers)
