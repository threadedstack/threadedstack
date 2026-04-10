import type { TSyncRule, TSyncRuleOverride, TSandboxSyncDefaults } from '@tdsk/domain'

import { describe, it, expect } from 'vitest'
import { mergeRules, resolveSourcePath } from '@TSA/services/sync/configLoader'

describe(`mergeRules`, () => {
  it(`returns config rules when no sandbox defaults exist`, () => {
    const rules: TSyncRule[] = [
      { name: `app`, source: `./src`, target: `/workspace/src`, mode: `one-way-replica` },
    ]
    const result = mergeRules(rules, undefined, undefined)
    expect(result).toEqual(rules)
  })

  it(`applies sandbox default targetBase when rule has no target`, () => {
    const rules: TSyncRule[] = [{ name: `app`, source: `./src` }]
    const defaults: TSandboxSyncDefaults = { targetBase: `/workspace/custom` }
    const result = mergeRules(rules, defaults, undefined)
    expect(result[0].target).toBe(`/workspace/custom`)
  })

  it(`applies sandbox default mode when rule has no mode`, () => {
    const rules: TSyncRule[] = [{ name: `app`, source: `./src` }]
    const defaults: TSandboxSyncDefaults = { mode: `two-way-safe` }
    const result = mergeRules(rules, defaults, undefined)
    expect(result[0].mode).toBe(`two-way-safe`)
  })

  it(`rule-level target/mode wins over sandbox defaults`, () => {
    const rules: TSyncRule[] = [
      { name: `app`, source: `./src`, target: `/app`, mode: `one-way-safe` },
    ]
    const defaults: TSandboxSyncDefaults = {
      targetBase: `/workspace`,
      mode: `two-way-safe`,
    }
    const result = mergeRules(rules, defaults, undefined)
    expect(result[0].target).toBe(`/app`)
    expect(result[0].mode).toBe(`one-way-safe`)
  })

  it(`applies per-sandbox overrides by matching rule name`, () => {
    const rules: TSyncRule[] = [
      { name: `app`, source: `./src`, target: `/workspace/src` },
    ]
    const sandboxOverrides: TSyncRuleOverride[] = [
      { name: `app`, target: `/workspace/custom`, ignores: [`vendor/`] },
    ]
    const result = mergeRules(rules, undefined, sandboxOverrides)
    expect(result[0].target).toBe(`/workspace/custom`)
    expect(result[0].ignores).toEqual([`vendor/`])
  })

  it(`falls back to /workspace as default target`, () => {
    const rules: TSyncRule[] = [{ name: `app`, source: `./src` }]
    const result = mergeRules(rules, undefined, undefined)
    expect(result[0].target).toBe(`/workspace`)
  })

  it(`falls back to one-way-replica as default mode`, () => {
    const rules: TSyncRule[] = [{ name: `app`, source: `./src` }]
    const result = mergeRules(rules, undefined, undefined)
    expect(result[0].mode).toBe(`one-way-replica`)
  })
})

describe(`resolveSourcePath`, () => {
  it(`resolves relative path against cwd`, () => {
    const result = resolveSourcePath(`./src`, `/home/user/project`)
    expect(result).toBe(`/home/user/project/src`)
  })

  it(`preserves absolute path as-is`, () => {
    const result = resolveSourcePath(`/absolute/path`, `/home/user/project`)
    expect(result).toBe(`/absolute/path`)
  })
})
