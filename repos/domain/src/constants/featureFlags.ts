import type { TFeatureFlags, TFeatureFlagName } from '@TDM/types'

export const FeatureFlags: TFeatureFlags = {
  agents: {
    enabled: true,
    description: `AI agent orchestration system`,
  },
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
  memories: {
    enabled: true,
    description: `Durable agent memory store with scored retrieval`,
  },
  delegation: {
    enabled: true,
    description: `Bounded task delegation via in-pod child coding processes`,
  },
  sensing: {
    enabled: true,
    description: `Sensor cycle: system signals → self-authored backlog (P4a)`,
  },
}

export function isFeatureEnabled(flag: TFeatureFlagName): boolean {
  return FeatureFlags[flag]?.enabled ?? false
}
