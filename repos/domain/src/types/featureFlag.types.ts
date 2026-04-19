export type TFeatureFlagDef = {
  enabled: boolean
  description: string
}

export type TFeatureFlags = Record<string, TFeatureFlagDef> & {
  skills: TFeatureFlagDef
  schedules: TFeatureFlagDef
  terminalGui: TFeatureFlagDef
}

export type TFeatureFlagName = keyof TFeatureFlags
