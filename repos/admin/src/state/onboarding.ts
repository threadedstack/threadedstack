import type { TOnboardingState } from '@TAF/types'

import { atomWithReset } from 'jotai/utils'
import { DefOnboardingState } from '@TAF/constants/onboarding'

export const onboardingState = atomWithReset<TOnboardingState>(DefOnboardingState)
