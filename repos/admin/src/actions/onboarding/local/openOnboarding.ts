import type { TOnboardingState } from '@TAF/types'

import { setOnboardingState } from '@TAF/state/accessors'
import { DefOnboardingState, OnboardingSteps } from '@TAF/constants/onboarding'

export const openOnboarding = (opts?: Partial<Omit<TOnboardingState, 'open'>>) => {
  const startStep =
    opts?.startStep != null
      ? Math.max(0, Math.min(opts.startStep, OnboardingSteps.length - 1))
      : undefined

  setOnboardingState({
    ...DefOnboardingState,
    ...opts,
    ...(startStep != null && { startStep }),
    open: true,
  })
}
