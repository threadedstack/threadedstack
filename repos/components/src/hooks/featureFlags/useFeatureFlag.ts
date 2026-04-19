import { isFeatureEnabled, type TFeatureFlagName } from '@tdsk/domain'

export function useFeatureFlag(flag: TFeatureFlagName): boolean {
  return isFeatureEnabled(flag)
}
