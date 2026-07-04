import { describe, it, expect } from 'vitest'

import { ESandboxRuntime } from '@tdsk/domain'
import {
  escapePromptArg,
  foregroundEnvPrefix,
  resolvePromptTemplate,
  substitutePlaceholders,
} from '@TBE/utils/agent/promptCommand'

describe(`foregroundEnvPrefix`, () => {
  it(`forces claude-code one-shot runs to disable background tasks`, () => {
    expect(foregroundEnvPrefix(ESandboxRuntime.claudeCode)).toBe(
      `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`
    )
  })

  it(`returns an empty prefix for runtimes needing no guard`, () => {
    expect(foregroundEnvPrefix(ESandboxRuntime.codex)).toBe(``)
    expect(foregroundEnvPrefix(ESandboxRuntime.openCode)).toBe(``)
  })

  it(`returns an empty prefix for unknown or missing runtimes`, () => {
    expect(foregroundEnvPrefix(`nope`)).toBe(``)
    expect(foregroundEnvPrefix(undefined)).toBe(``)
  })

  it(`composes as a valid inline env prefix ahead of the runtime command`, () => {
    const prefix = foregroundEnvPrefix(ESandboxRuntime.claudeCode)
    const command = substitutePlaceholders(`claude -p '{prompt}'`, {
      prompt: escapePromptArg(`do the thing`),
    })
    // `VAR=1 claude ...` is a POSIX inline env assignment inherited by the command.
    expect(`${prefix} ${command}`).toBe(
      `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1 claude -p 'do the thing'`
    )
  })
})

describe(`escapePromptArg`, () => {
  it(`escapes single quotes for single-quoted shell embedding`, () => {
    expect(escapePromptArg(`it's done`)).toBe(`it'\\''s done`)
  })

  it(`leaves text without quotes untouched`, () => {
    expect(escapePromptArg(`plain text`)).toBe(`plain text`)
  })
})

describe(`substitutePlaceholders`, () => {
  it(`substitutes prompt and soul placeholders`, () => {
    expect(
      substitutePlaceholders(`run '{soul}' then '{prompt}'`, {
        soul: `identity`,
        prompt: `the task`,
      })
    ).toBe(`run 'identity' then 'the task'`)
  })

  it(`leaves placeholders without a provided value untouched`, () => {
    expect(substitutePlaceholders(`run '{soul}' '{prompt}'`, { prompt: `x` })).toBe(
      `run '{soul}' 'x'`
    )
  })

  it(`is immune to $-replacement patterns in substituted text`, () => {
    expect(substitutePlaceholders(`p: {prompt}`, { prompt: `costs $& and $\`` })).toBe(
      `p: costs $& and $\``
    )
  })

  it(`never re-matches placeholder text introduced by a substitution`, () => {
    expect(
      substitutePlaceholders(`{soul} {prompt}`, {
        soul: `literal {prompt} inside`,
        prompt: `real`,
      })
    ).toBe(`literal {prompt} inside real`)
  })
})

describe(`resolvePromptTemplate`, () => {
  it(`prefers the sandbox config's own promptCommand`, () => {
    expect(
      resolvePromptTemplate({
        promptCommand: `mytool --ask '{prompt}'`,
        runtime: ESandboxRuntime.claudeCode,
      } as any)
    ).toBe(`mytool --ask '{prompt}'`)
  })

  it(`falls back to the runtime's built-in template`, () => {
    expect(resolvePromptTemplate({ runtime: ESandboxRuntime.claudeCode } as any)).toBe(
      `claude -p '{prompt}'`
    )
  })

  it(`throws when no template exists for the runtime`, () => {
    expect(() => resolvePromptTemplate({ runtime: `nope` } as any)).toThrow(
      `No prompt command template`
    )
  })

  it(`throws when the template is missing the {prompt} placeholder`, () => {
    expect(() =>
      resolvePromptTemplate({
        promptCommand: `mytool --ask`,
        runtime: ESandboxRuntime.claudeCode,
      } as any)
    ).toThrow(`missing {prompt} placeholder`)
  })

  it(`throws when {prompt} is not single-quoted (escaping contract)`, () => {
    for (const promptCommand of [`mytool --ask {prompt}`, `mytool --ask "{prompt}"`]) {
      expect(() =>
        resolvePromptTemplate({
          promptCommand,
          runtime: ESandboxRuntime.claudeCode,
        } as any)
      ).toThrow(`must wrap {prompt}/{soul} in single quotes`)
    }
  })

  it(`throws when {soul} is present but not single-quoted`, () => {
    expect(() =>
      resolvePromptTemplate({
        promptCommand: `mytool --soul {soul} --ask '{prompt}'`,
        runtime: ESandboxRuntime.claudeCode,
      } as any)
    ).toThrow(`must wrap {prompt}/{soul} in single quotes`)
  })

  it(`accepts single-quoted {soul} and {prompt} together`, () => {
    const template = `claude -p --append-system-prompt '{soul}' '{prompt}'`
    expect(resolvePromptTemplate({ promptCommand: template } as any)).toBe(template)
  })
})
