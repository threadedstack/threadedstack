import type { ReactNode } from 'react'
import type { TFeatureFlagName } from '@tdsk/domain'
import { useFeatureFlag } from '../../hooks/featureFlags/useFeatureFlag'

export type TFeatureGateProps = {
  flag: TFeatureFlagName
  children: ReactNode
  fallback?: ReactNode
}

export function FeatureGate({ flag, children, fallback = null }: TFeatureGateProps) {
  const enabled = useFeatureFlag(flag)
  return enabled ? <>{children}</> : <>{fallback}</>
}
