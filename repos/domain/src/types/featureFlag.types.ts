export type TFeatureFlagDef = {
  enabled: boolean
  description: string
}

export type TFeatureFlags = {
  skills: TFeatureFlagDef
  schedules: TFeatureFlagDef
  accessGate: TFeatureFlagDef
  terminalGui: TFeatureFlagDef
}

export type TFeatureFlagName = keyof TFeatureFlags
