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
  collections: {
    enabled: true,
    description: `Project-scoped Collections/Records store with a safe query API`,
  },
  delegation: {
    enabled: true,
    description: `Bounded task delegation via in-pod child coding processes`,
  },
  sensing: {
    enabled: true,
    description: `Sensor cycle: system signals → self-authored backlog (P4a)`,
  },
  escalation: {
    enabled: true,
    description: `Structured escalation channel with auto-routing (P4b)`,
  },
  verification: {
    enabled: true,
    description: `Post-merge verify + auto revert on regression (P4c)`,
  },
  ops: {
    enabled: true,
    description: `Allowlisted ops actions with dry-run + adversary review (P4d, READ then WRITE)`,
  },
}

export function isFeatureEnabled(flag: TFeatureFlagName): boolean {
  return FeatureFlags[flag]?.enabled ?? false
}
