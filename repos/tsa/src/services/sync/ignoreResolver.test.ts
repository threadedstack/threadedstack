import { describe, it, expect } from 'vitest'
import { DefSyncIgnores } from '@TSA/constants/sync'
import { resolveIgnores } from '@TSA/services/sync/ignoreResolver'

describe(`resolveIgnores`, () => {
  it(`returns builtin defaults when no additional ignores provided`, () => {
    const result = resolveIgnores({})
    expect(result).toEqual(DefSyncIgnores)
  })

  it(`appends sandbox-level ignores after builtins`, () => {
    const result = resolveIgnores({ sandboxIgnores: [`vendor/`] })
    expect(result).toEqual([...DefSyncIgnores, `vendor/`])
  })

  it(`appends config-level default ignores after sandbox ignores`, () => {
    const result = resolveIgnores({
      sandboxIgnores: [`vendor/`],
      configDefaultIgnores: [`tmp/`],
    })
    expect(result).toEqual([...DefSyncIgnores, `vendor/`, `tmp/`])
  })

  it(`appends rule-specific ignores last`, () => {
    const result = resolveIgnores({
      ruleIgnores: [`dist/`, `*.map`],
    })
    expect(result).toEqual([...DefSyncIgnores, `dist/`, `*.map`])
  })

  it(`processes ! negations by removing matching patterns from earlier layers`, () => {
    const result = resolveIgnores({
      ruleIgnores: [`!node_modules/`],
    })
    expect(result).not.toContain(`node_modules/`)
    expect(result).not.toContain(`!node_modules/`)
  })

  it(`deduplicates patterns`, () => {
    const result = resolveIgnores({
      sandboxIgnores: [`.git/`],
      configDefaultIgnores: [`.git/`],
    })
    const gitCount = result.filter((p) => p === `.git/`).length
    expect(gitCount).toBe(1)
  })

  it(`skips builtins when skipDefaults is true`, () => {
    const result = resolveIgnores({ skipDefaults: true, ruleIgnores: [`dist/`] })
    expect(result).toEqual([`dist/`])
    expect(result).not.toContain(`.git/`)
  })

  it(`handles all layers combined with negation`, () => {
    const result = resolveIgnores({
      sandboxIgnores: [`vendor/`],
      configDefaultIgnores: [`tmp/`],
      ruleIgnores: [`dist/`, `!.env`],
    })
    expect(result).toContain(`vendor/`)
    expect(result).toContain(`tmp/`)
    expect(result).toContain(`dist/`)
    expect(result).not.toContain(`.env`)
    expect(result).not.toContain(`!.env`)
  })
})
