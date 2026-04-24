import type { TFeatureFlags, TFeatureFlagName } from '@TDM/types'

export const FeatureFlags: TFeatureFlags = {
  skills: {
    enabled: false,
    description: `Agent skill system`,
  },
  schedules: {
    enabled: false,
    description: `Cron-based agent execution`,
  },
  terminalGui: {
    enabled: false,
    description: `AST overlay for terminal output (generative UI)`,
  },
}

export function isFeatureEnabled(flag: TFeatureFlagName): boolean {
  return FeatureFlags[flag]?.enabled ?? false
}
