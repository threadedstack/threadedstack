import type { TSyncRule, TSyncRuleOverride, TSandboxSyncDefaults } from '@tdsk/domain'

import { resolve, isAbsolute } from 'path'
import { DefSyncTarget, DefSyncMode } from '@TSA/constants/sync'

export const resolveSourcePath = (source: string, cwd: string): string => {
  return isAbsolute(source) ? source : resolve(cwd, source)
}

export const mergeRules = (
  rules: TSyncRule[],
  sandboxDefaults: TSandboxSyncDefaults | undefined,
  sandboxOverrides: TSyncRuleOverride[] | undefined
): TSyncRule[] => {
  return rules.map((rule) => {
    // Find per-sandbox override by name match
    const override = sandboxOverrides?.find((o) => o.name === rule.name)

    // Merge: override > rule > sandbox defaults > built-in defaults
    return {
      name: rule.name,
      source: override?.source || rule.source,
      ignores: override?.ignores || rule.ignores,
      mode: override?.mode || rule.mode || sandboxDefaults?.mode || DefSyncMode,
      target:
        override?.target || rule.target || sandboxDefaults?.targetBase || DefSyncTarget,
    }
  })
}
