export type TFeatureFlagDef = {
  enabled: boolean
  description: string
}

export type TFeatureFlags = {
  agents: TFeatureFlagDef
  skills: TFeatureFlagDef
  memories: TFeatureFlagDef
  schedules: TFeatureFlagDef
  accessGate: TFeatureFlagDef
  terminalGui: TFeatureFlagDef
}

export type TFeatureFlagName = keyof TFeatureFlags
