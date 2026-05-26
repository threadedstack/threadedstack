import { useState, useCallback, useEffect } from 'react'
import type {
  TStepResult,
  TOnboardingOrgData,
  TOnboardingStepData,
  TOnboardingProjectData,
  TOnboardingProviderData,
} from '@TAF/types'

import { nav } from '@TAF/services'
import { getOrgs } from '@TAF/state/accessors'
import { AIProviderTemplates } from '@tdsk/domain'
import { DefStepData, StepKeys } from '@TAF/types'
import { useOnboardingState } from '@TAF/state/selectors'
import { createOrg } from '@TAF/actions/orgs/api/createOrg'
import { OnboardingSteps } from '@TAF/constants/onboarding'
import { createSecret } from '@TAF/actions/secrets/api/createSecret'
import { createProject } from '@TAF/actions/projects/api/createProject'
import { updateSandbox } from '@TAF/actions/sandboxes/api/updateSandbox'
import { fetchSandboxes } from '@TAF/actions/sandboxes/api/fetchSandboxes'
import { createProvider } from '@TAF/actions/providers/api/createProvider'
import { updateProvider } from '@TAF/actions/providers/api/updateProvider'
import { closeOnboarding } from '@TAF/actions/onboarding/local/closeOnboarding'

export const useOnboarding = () => {
  const [onboarding] = useOnboardingState()

  const [activeStep, setActiveStep] = useState(onboarding.startStep || 0)
  const [stepData, setStepData] = useState<TOnboardingStepData>(DefStepData)
  const [submitting, setSubmitting] = useState(false)
  const [submitStep, setSubmitStep] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [returnToReview, setReturnToReview] = useState(false)

  useEffect(() => {
    if (onboarding.open) {
      setActiveStep(onboarding.startStep || 0)

      let initialStepData = DefStepData
      if (onboarding.orgId) {
        const orgs = getOrgs()
        const org = orgs?.[onboarding.orgId]
        initialStepData = {
          ...DefStepData,
          org: {
            mode: `select`,
            selectedId: onboarding.orgId,
            selectedName: org?.name || ``,
          },
        }
      }
      setStepData(initialStepData)

      setError(null)
      setSubmitting(false)
      setSubmitStep(null)
      setReturnToReview(false)
    }
  }, [onboarding.open, onboarding.startStep, onboarding.orgId])

  const steps = OnboardingSteps

  const isFirstStep = activeStep === 0
  const isLastStep = activeStep === steps.length - 1
  const isReviewStep = activeStep === steps.length - 1

  // Fix 2: Derive skipped state from stepData instead of maintaining a separate Set.
  const isStepSkipped = useCallback(
    (stepIndex: number): boolean => {
      const key = StepKeys[stepIndex]
      return key ? stepData[key].mode === `skip` : false
    },
    [stepData]
  )

  const isProviderSkipped = isStepSkipped(1)
  const isProjectSkipped = isStepSkipped(2)

  const canDismiss = onboarding.mode === `manual`

  const onNext = useCallback(() => {
    if (activeStep < steps.length - 1) {
      setError(null)
      if (activeStep === 2) {
        const orgId = onboarding.orgId || stepData.org.selectedId
        if (orgId)
          fetchSandboxes({ orgId }).catch(() =>
            setError(`Failed to load sandboxes. You can configure them later.`)
          )
      }
      setActiveStep((s) => s + 1)
    }
  }, [activeStep, steps.length, onboarding.orgId, stepData.org.selectedId])

  const onBack = useCallback(() => {
    if (activeStep > 0) {
      setError(null)
      setActiveStep((s) => s - 1)
    }
  }, [activeStep])

  const onStepClick = useCallback(
    (stepIndex: number) => {
      if (stepIndex < activeStep || isStepSkipped(stepIndex)) {
        if (isReviewStep && stepIndex < activeStep) {
          setReturnToReview(true)
        }
        setError(null)
        setActiveStep(stepIndex)
      }
    },
    [activeStep, isStepSkipped, isReviewStep]
  )

  const onReturnToReview = useCallback(() => {
    setReturnToReview(false)
    setActiveStep(steps.length - 1)
  }, [steps.length])

  const onSkip = useCallback(
    (stepIndex: number) => {
      const stepKey = StepKeys[stepIndex]
      if (stepKey) {
        setStepData((prev) => ({
          ...prev,
          [stepKey]: { mode: `skip` as const },
        }))
      }
      onNext()
    },
    [onNext]
  )

  const updateStepData = useCallback(
    <K extends keyof TOnboardingStepData>(key: K, data: TOnboardingStepData[K]) => {
      setStepData((prev) => ({ ...prev, [key]: data }))
    },
    []
  )

  const getStepResult = useCallback(
    (stepIndex: number): TStepResult => {
      if (isStepSkipped(stepIndex)) return { outcome: `skipped` }
      const key = StepKeys[stepIndex]
      if (!key) return { outcome: `skipped` }
      const data = stepData[key]
      if (data.mode === `select`)
        return {
          outcome: `selected`,
          resourceId: data.selectedId,
          resourceName: data.selectedName,
        }
      if (data.mode === `create`) {
        const name =
          key === `org`
            ? (stepData.org.data as TOnboardingOrgData | undefined)?.name
            : key === `provider`
              ? (stepData.provider.data as TOnboardingProviderData | undefined)
                  ?.providerBrand
              : key === `project`
                ? (stepData.project.data as TOnboardingProjectData | undefined)?.name
                : undefined
        return { outcome: `creating`, resourceName: name }
      }
      return { outcome: `skipped` }
    },
    [stepData, isStepSkipped]
  )

  const onSubmit = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    setSubmitStep(null)

    let wasNewOrg = false
    let succeeded = false
    let currentStep: number | null = null
    let projectId = stepData.project.selectedId
    let providerId = stepData.provider.selectedId
    let orgId = onboarding.orgId || stepData.org.selectedId

    try {
      // Step 1: Org (skip when pre-selected via onboarding.orgId)
      if (!onboarding.orgId && stepData.org.mode === `create` && stepData.org.data) {
        currentStep = 0
        setSubmitStep(0)
        wasNewOrg = true
        const result = await createOrg({
          name: stepData.org.data.name,
          description: stepData.org.data.description || undefined,
        })
        if (result.error) throw result.error
        if (!result.org)
          throw new Error(`Organization was created but the server returned no data`)

        orgId = result.org.id
        setStepData((prev) => ({
          ...prev,
          org: {
            mode: `select`,
            selectedId: result.org!.id,
            selectedName: result.org!.name || stepData.org.data?.name || ``,
          },
        }))
      }

      if (!orgId) throw new Error(`Organization is required`)

      // Step 2: Provider
      if (
        !isStepSkipped(1) &&
        stepData.provider.mode === `create` &&
        stepData.provider.data
      ) {
        currentStep = 1
        setSubmitStep(1)
        const result = await createProvider({
          orgId,
          data: {
            name:
              stepData.provider.data.providerName ||
              `${stepData.provider.data.providerBrand}-provider`,
            type: `ai`,
            orgId,
            brand: stepData.provider.data.providerBrand,
            options: stepData.provider.data.providerUrl
              ? { baseUrl: stepData.provider.data.providerUrl }
              : {},
          },
        })
        if (result.error) throw result.error
        if (!result.data)
          throw new Error(`Provider was created but the server returned no data`)

        providerId = result.data.id
        setStepData((prev) => ({
          ...prev,
          provider: {
            mode: `select`,
            selectedId: result.data!.id,
            selectedName:
              result.data!.name || stepData.provider.data?.providerBrand || ``,
          },
        }))

        const apiKey = stepData.provider.data?.apiKey?.trim()
        if (apiKey && providerId) {
          const brand = stepData.provider.data?.providerBrand
          const template = brand
            ? AIProviderTemplates[brand as keyof typeof AIProviderTemplates]
            : undefined
          const secretName =
            template?.defaultSecretName ||
            `${(stepData.provider.data?.providerName || brand || `PROVIDER`).toUpperCase().replace(/\s+/g, `_`)}_API_KEY`

          const secretResult = await createSecret({
            orgId,
            name: secretName,
            value: apiKey,
            providerId,
          })
          if (secretResult.error) throw secretResult.error

          if (secretResult.data?.id) {
            const updateResult = await updateProvider({
              orgId,
              id: providerId,
              data: { secretId: secretResult.data.id },
            })
            if (updateResult.error) throw updateResult.error
          }
        }
      }

      // Step 3: Project
      if (
        !isStepSkipped(2) &&
        stepData.project.mode === `create` &&
        stepData.project.data
      ) {
        currentStep = 2
        setSubmitStep(2)
        const result = await createProject({
          name: stepData.project.data.name,
          description: stepData.project.data.description || undefined,
          orgId,
        })
        if (result.error) throw result.error
        if (!result.data) throw new Error(`Project creation returned no data`)

        projectId = result.data.id
        setStepData((prev) => ({
          ...prev,
          project: {
            mode: `select`,
            selectedId: result.data!.id,
            selectedName: result.data!.name || stepData.project.data?.name || ``,
          },
        }))
      } else if (
        !isStepSkipped(2) &&
        stepData.project.mode === `select` &&
        stepData.project.selectedId
      ) {
        projectId = stepData.project.selectedId
      }

      // Step 4: Sandbox linking
      if (!isStepSkipped(3) && stepData.sandbox.selectedName) {
        currentStep = 3
        setSubmitStep(3)
        const linkData: Record<string, any> = {}
        if (providerId) linkData.providerInputs = [{ id: providerId }]
        if (projectId) linkData.projectIds = [projectId]

        if (Object.keys(linkData).length > 0) {
          let sandboxId: string | undefined

          if (wasNewOrg) {
            const sbResult = await fetchSandboxes({ orgId })
            if (sbResult.error)
              throw new Error(
                `Failed to load sandboxes: ${sbResult.error.message || `Unknown error`}`
              )

            const orgSandboxes = sbResult.data ? Object.values(sbResult.data) : []
            const match = orgSandboxes.find(
              (sb) => sb.name === stepData.sandbox.selectedName
            )
            if (!match)
              throw new Error(
                `Sandbox "${stepData.sandbox.selectedName}" was not found after organization setup`
              )

            sandboxId = match.id
          } else {
            sandboxId = stepData.sandbox.selectedId
          }

          if (sandboxId) {
            const result = await updateSandbox({
              id: sandboxId,
              orgId,
              data: linkData,
            })
            if (result.error) throw result.error
          }
        }
      }

      succeeded = true
    } catch (err: any) {
      console.error(`[useOnboarding] Submit failed at step ${currentStep}:`, err)
      const stepName = currentStep !== null ? OnboardingSteps[currentStep] : `unknown`
      const message = err?.message || `An error occurred during setup`
      setError(`Failed during ${stepName} setup: ${message}`)
    } finally {
      setSubmitting(false)
      if (succeeded) {
        closeOnboarding()
        history.replaceState({}, ``, window.location.pathname)
        if (projectId && orgId) nav.to(`/orgs/${orgId}/projects/${projectId}`)
        else if (orgId) nav.to(`/orgs/${orgId}`)
      }
    }
  }, [onboarding, stepData, isStepSkipped])

  const onClose = useCallback(() => {
    if (!canDismiss) return
    closeOnboarding()
    setActiveStep(0)
    setStepData(DefStepData)
    setError(null)
    setSubmitting(false)
    setSubmitStep(null)
    setReturnToReview(false)
  }, [canDismiss])

  return {
    steps,
    error,
    onBack,
    onNext,
    onSkip,
    onClose,
    onSubmit,
    stepData,
    submitting,
    onboarding,
    submitStep,
    activeStep,
    canDismiss,
    isLastStep,
    isFirstStep,
    isReviewStep,
    onStepClick,
    getStepResult,
    setActiveStep,
    updateStepData,
    returnToReview,
    isStepSkipped,
    onReturnToReview,
    isProjectSkipped,
    isProviderSkipped,
  }
}
