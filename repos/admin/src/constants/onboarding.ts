import type { TOnboardingState } from '@TAF/types'

export const DefOnboardingState: TOnboardingState = {
  open: false,
  mode: `auto`,
}

export const OnboardingSteps = [
  `Organization`,
  `Provider`,
  `Project`,
  `Sandbox`,
  `Review`,
] as const
