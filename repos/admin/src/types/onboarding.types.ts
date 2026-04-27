import type { TLLMProviderBrand } from '@tdsk/domain'
import type { OnboardingSteps } from '@TAF/constants/onboarding'

export type TOnboardingMode = `auto` | `manual`

export type TOnboardingState = {
  open: boolean
  orgId?: string
  startStep?: number
  mode: TOnboardingMode
}

export type TOnboardingProviderData = {
  apiKey: string
  model: string
  providerUrl: string
  providerName: string
  providerBrand: TLLMProviderBrand
}

export type TOnboardingProjectData = {
  name: string
  description: string
}

export type TOnboardingOrgData = {
  name: string
  description: string
}

export type TOnboardingSandboxData = {
  sandboxId: string
}

export type TStepOutcome = `creating` | `selected` | `skipped`
export type TOnboardingStepMode = `create` | `select` | `skip`

export type TStepCreate<D> = {
  mode: `create`
  data: D
  selectedId?: undefined
  selectedName?: undefined
}

export type TStepSelect = {
  mode: `select`
  data?: undefined
  selectedId: string
  selectedName: string
}

export type TStepSkip = {
  mode: `skip`
  data?: undefined
  selectedId?: undefined
  selectedName?: undefined
}

export type TSkippableStep<D> = TStepCreate<D> | TStepSelect | TStepSkip
export type TRequiredStep<D> = TStepCreate<D> | TStepSelect

export type TOnboardingStepData = {
  org: TRequiredStep<TOnboardingOrgData>
  provider: TSkippableStep<TOnboardingProviderData>
  project: TSkippableStep<TOnboardingProjectData>
  sandbox: TSkippableStep<TOnboardingSandboxData>
}

export type TStepResult = {
  resourceId?: string
  resourceName?: string
  outcome: TStepOutcome
}

export const StepKeys = [`org`, `provider`, `project`, `sandbox`] as const
export type TStepKey = (typeof StepKeys)[number]

export const DefStepData: TOnboardingStepData = {
  org: { mode: `create`, data: { name: ``, description: `` } },
  provider: {
    mode: `create`,
    data: {
      apiKey: ``,
      model: ``,
      providerUrl: ``,
      providerName: ``,
      providerBrand: `anthropic` as TLLMProviderBrand,
    },
  },
  project: { mode: `create`, data: { name: ``, description: `` } },
  sandbox: { mode: `create`, data: { sandboxId: `` } },
}

export type TOnboardingStepName = (typeof OnboardingSteps)[number]
