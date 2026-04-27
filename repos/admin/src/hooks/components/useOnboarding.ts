import { useState, useCallback, useEffect } from 'react'
import type {
  TStepResult,
  TOnboardingOrgData,
  TOnboardingStepData,
  TOnboardingProjectData,
  TOnboardingProviderData,
} from '@TAF/types'

import { nav } from '@TAF/services'
import { DefStepData, StepKeys } from '@TAF/types'
import { useOnboardingState } from '@TAF/state/selectors'
import { createOrg } from '@TAF/actions/orgs/api/createOrg'
import { OnboardingSteps } from '@TAF/constants/onboarding'
import { createProject } from '@TAF/actions/projects/api/createProject'
import { updateSandbox } from '@TAF/actions/sandboxes/api/updateSandbox'
import { createProvider } from '@TAF/actions/providers/api/createProvider'
import { closeOnboarding } from '@TAF/actions/onboarding/local/closeOnboarding'

export const useOnboarding = () => {
  const [onboarding] = useOnboardingState()

  const [activeStep, setActiveStep] = useState(onboarding.startStep || 0)
  const [stepData, setStepData] = useState<TOnboardingStepData>(DefStepData)
  const [submitting, setSubmitting] = useState(false)
  const [submitStep, setSubmitStep] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fix 1: Reset all local state when wizard opens so stale state from previous
  // sessions is cleared (MUI Dialog doesn't unmount children on close).
  // Also ensures startStep is honoured on every re-open.
  useEffect(() => {
    if (onboarding.open) {
      setActiveStep(onboarding.startStep || 0)
      setStepData(DefStepData)
      setError(null)
      setSubmitting(false)
      setSubmitStep(null)
    }
  }, [onboarding.open, onboarding.startStep])

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
      setActiveStep((s) => s + 1)
    }
  }, [activeStep, steps.length])

  const onBack = useCallback(() => {
    if (activeStep > 0) {
      setError(null)
      setActiveStep((s) => s - 1)
    }
  }, [activeStep])

  const onStepClick = useCallback(
    (stepIndex: number) => {
      if (stepIndex < activeStep || isStepSkipped(stepIndex)) {
        setError(null)
        setActiveStep(stepIndex)
      }
    },
    [activeStep, isStepSkipped]
  )

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
                : key === `sandbox`
                  ? data.selectedName
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

    let orgId = onboarding.orgId || stepData.org.selectedId
    let providerId = stepData.provider.selectedId
    let projectId = stepData.project.selectedId

    let succeeded = false
    let currentStep: number | null = null
    try {
      // Step 1: Org
      if (stepData.org.mode === `create` && stepData.org.data) {
        currentStep = 0
        setSubmitStep(0)
        const result = await createOrg({
          name: stepData.org.data.name,
          description: stepData.org.data.description || undefined,
        })
        if (result.error) throw result.error
        // Fix 3a: Reflect created resource in stepData to prevent duplicate creation on retry.
        if (result.org) {
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
        // Fix 3a: Reflect created provider in stepData.
        if (result.data) {
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
        // Fix 3a: Reflect created project in stepData.
        if (result.data) {
          projectId = result.data.id
          setStepData((prev) => ({
            ...prev,
            project: {
              mode: `select`,
              selectedId: result.data!.id,
              selectedName: result.data!.name || stepData.project.data?.name || ``,
            },
          }))
        }
      }

      // Step 4: Sandbox linking
      if (!isStepSkipped(3) && stepData.sandbox.selectedId) {
        currentStep = 3
        setSubmitStep(3)
        const updateData: Record<string, any> = {}
        if (providerId) updateData.providerInputs = [{ id: providerId }]
        if (projectId) updateData.projectIds = [projectId]

        if (Object.keys(updateData).length > 0) {
          const result = await updateSandbox({
            id: stepData.sandbox.selectedId,
            orgId,
            data: updateData,
          })
          if (result.error) throw result.error
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
    isStepSkipped,
    isProjectSkipped,
    isProviderSkipped,
  }
}
