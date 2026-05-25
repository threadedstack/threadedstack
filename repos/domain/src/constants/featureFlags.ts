import type { TFeatureFlags, TFeatureFlagName } from '@TDM/types'

export const FeatureFlags: TFeatureFlags = {
  skills: {
    enabled: true,
    description: `AI Agent and sandbox skill system`,
  },
  schedules: {
    enabled: true,
    description: `Cron-based sandbox execution`,
  },
  terminalGui: {
    enabled: false,
    description: `AST overlay for terminal output (generative UI)`,
  },
  accessGate: {
    enabled: true,
    description: `Alpha/beta access gating via user role field`,
  },
}

export function isFeatureEnabled(flag: TFeatureFlagName): boolean {
  return FeatureFlags[flag]?.enabled ?? false
}
