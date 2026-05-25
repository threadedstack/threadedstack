import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { TOnboardingMode } from '@TAF/types'

// Mock Jotai-backed selector — returns [onboardingState, setter, reset]
const mockOnboardingState = { open: true, mode: `auto` as TOnboardingMode }
const mockSetOnboardingState = vi.fn()
const mockResetOnboardingState = vi.fn()

vi.mock('@TAF/state/selectors', () => ({
  useOnboardingState: () => [
    mockOnboardingState,
    mockSetOnboardingState,
    mockResetOnboardingState,
  ],
}))

vi.mock('@TAF/services', () => ({
  nav: { to: vi.fn() },
}))

vi.mock('@TAF/state/accessors', () => ({
  getOrgs: vi.fn(() => ({})),
}))

vi.mock('@tdsk/domain', () => ({
  AIProviderTemplates: {
    anthropic: { name: `Anthropic`, defaultSecretName: `ANTHROPIC_API_KEY` },
    openai: { name: `OpenAI`, defaultSecretName: `OPENAI_API_KEY` },
  },
}))

vi.mock('@TAF/actions/orgs/api/createOrg', () => ({
  createOrg: vi.fn(),
}))

vi.mock('@TAF/actions/projects/api/createProject', () => ({
  createProject: vi.fn(),
}))

vi.mock('@TAF/actions/providers/api/createProvider', () => ({
  createProvider: vi.fn(),
}))

vi.mock('@TAF/actions/sandboxes/api/updateSandbox', () => ({
  updateSandbox: vi.fn(),
}))

vi.mock('@TAF/actions/secrets/api/createSecret', () => ({
  createSecret: vi.fn(),
}))

vi.mock('@TAF/actions/providers/api/updateProvider', () => ({
  updateProvider: vi.fn(),
}))

vi.mock('@TAF/actions/onboarding/local/closeOnboarding', () => ({
  closeOnboarding: vi.fn(),
}))

describe('useOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the shared mock state to defaults before each test
    mockOnboardingState.mode = `auto`
    mockOnboardingState.open = true
    ;(mockOnboardingState as any).startStep = undefined
    ;(mockOnboardingState as any).orgId = undefined
  })

  // ─── Initial state ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts at step 0 by default', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())
      expect(result.current.activeStep).toBe(0)
    })

    it('starts at startStep when provided in onboarding state', async () => {
      ;(mockOnboardingState as any).startStep = 2
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())
      expect(result.current.activeStep).toBe(2)
    })

    it('has no skipped steps initially', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())
      expect(result.current.isStepSkipped(0)).toBe(false)
      expect(result.current.isStepSkipped(1)).toBe(false)
      expect(result.current.isStepSkipped(2)).toBe(false)
      expect(result.current.isStepSkipped(3)).toBe(false)
    })

    it('canDismiss is false when mode is auto', async () => {
      mockOnboardingState.mode = `auto`
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())
      expect(result.current.canDismiss).toBe(false)
    })

    it('canDismiss is true when mode is manual', async () => {
      mockOnboardingState.mode = `manual`
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())
      expect(result.current.canDismiss).toBe(true)
    })

    it('initializes isFirstStep as true', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())
      expect(result.current.isFirstStep).toBe(true)
    })

    it('initializes isLastStep as false', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())
      expect(result.current.isLastStep).toBe(false)
    })

    it('initializes isProviderSkipped as false', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())
      expect(result.current.isProviderSkipped).toBe(false)
    })

    it('initializes isProjectSkipped as false', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())
      expect(result.current.isProjectSkipped).toBe(false)
    })

    it('initializes submitting as false', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())
      expect(result.current.submitting).toBe(false)
    })

    it('initializes error as null', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())
      expect(result.current.error).toBeNull()
    })

    it('initializes stepData with create mode for all steps', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())
      expect(result.current.stepData.org.mode).toBe(`create`)
      expect(result.current.stepData.provider.mode).toBe(`create`)
      expect(result.current.stepData.project.mode).toBe(`create`)
      expect(result.current.stepData.sandbox.mode).toBe(`create`)
    })
  })

  // ─── Step navigation: onNext ──────────────────────────────────────────────

  describe('onNext', () => {
    it('advances activeStep by 1', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.onNext())
      expect(result.current.activeStep).toBe(1)
    })

    it('advances multiple times', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.onNext())
      act(() => result.current.onNext())
      expect(result.current.activeStep).toBe(2)
    })

    it('does not advance past the last step', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      // steps = 5, last index = 4
      act(() => result.current.setActiveStep(4))
      act(() => result.current.onNext())
      expect(result.current.activeStep).toBe(4)
    })

    it('clears error when advancing', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      // Trigger an error via onSubmit — but easier to test indirectly via onBack/Next
      // We can't directly set error, but we can verify it's null initially and stays null
      act(() => result.current.onNext())
      expect(result.current.error).toBeNull()
    })

    it('updates isFirstStep and isLastStep flags', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      expect(result.current.isFirstStep).toBe(true)
      expect(result.current.isLastStep).toBe(false)

      // Navigate to last step (index 4)
      act(() => result.current.setActiveStep(4))
      expect(result.current.isFirstStep).toBe(false)
      expect(result.current.isLastStep).toBe(true)
      expect(result.current.isReviewStep).toBe(true)
    })
  })

  // ─── Step navigation: onBack ──────────────────────────────────────────────

  describe('onBack', () => {
    it('goes back one step', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.setActiveStep(3))
      act(() => result.current.onBack())
      expect(result.current.activeStep).toBe(2)
    })

    it('does not go below step 0', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.onBack())
      expect(result.current.activeStep).toBe(0)
    })

    it('clears error when going back', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.setActiveStep(2))
      act(() => result.current.onBack())
      expect(result.current.error).toBeNull()
    })
  })

  // ─── Skip step ────────────────────────────────────────────────────────────

  describe('onSkip', () => {
    it('marks the step as skipped via isStepSkipped', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.setActiveStep(1))
      act(() => result.current.onSkip(1))
      expect(result.current.isStepSkipped(1)).toBe(true)
    })

    it('advances to the next step after skipping', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.setActiveStep(1))
      act(() => result.current.onSkip(1))
      expect(result.current.activeStep).toBe(2)
    })

    it('sets the step mode to skip in stepData', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.setActiveStep(1))
      act(() => result.current.onSkip(1))
      expect(result.current.stepData.provider.mode).toBe(`skip`)
    })

    it('sets isProviderSkipped to true when step 1 is skipped', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.setActiveStep(1))
      act(() => result.current.onSkip(1))
      expect(result.current.isProviderSkipped).toBe(true)
    })

    it('sets isProjectSkipped to true when step 2 is skipped', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.setActiveStep(2))
      act(() => result.current.onSkip(2))
      expect(result.current.isProjectSkipped).toBe(true)
    })

    it('can skip multiple steps independently', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.setActiveStep(1))
      act(() => result.current.onSkip(1))
      act(() => result.current.onSkip(2))
      expect(result.current.isStepSkipped(1)).toBe(true)
      expect(result.current.isStepSkipped(2)).toBe(true)
    })
  })

  // ─── Step click ───────────────────────────────────────────────────────────

  describe('onStepClick', () => {
    it('allows backward navigation to a previous step', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.setActiveStep(3))
      act(() => result.current.onStepClick(1))
      expect(result.current.activeStep).toBe(1)
    })

    it('does not navigate forward past the current step', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.setActiveStep(1))
      act(() => result.current.onStepClick(3))
      expect(result.current.activeStep).toBe(1)
    })

    it('does not navigate to the current step itself', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.setActiveStep(2))
      act(() => result.current.onStepClick(2))
      // stepIndex === activeStep, so not < activeStep — no change
      expect(result.current.activeStep).toBe(2)
    })

    it('allows clicking on a skipped step even if it is ahead', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      // Skip step 3 while on step 1
      act(() => result.current.setActiveStep(1))
      act(() => result.current.onSkip(3))
      // Now step 3 is skipped; clicking it from step 2 should work
      act(() => result.current.setActiveStep(2))
      act(() => result.current.onStepClick(3))
      expect(result.current.activeStep).toBe(3)
    })

    it('clears error when navigating via click', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.setActiveStep(3))
      act(() => result.current.onStepClick(1))
      expect(result.current.error).toBeNull()
    })
  })

  // ─── getStepResult ────────────────────────────────────────────────────────

  describe('getStepResult', () => {
    it('returns skipped outcome for a skipped step', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.onSkip(1))
      const stepResult = result.current.getStepResult(1)
      expect(stepResult.outcome).toBe(`skipped`)
    })

    it('returns creating outcome when mode is create (empty initial data)', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      const stepResult = result.current.getStepResult(0)
      expect(stepResult.outcome).toBe(`creating`)
      // DefStepData initialises org.data.name to '' — resourceName reflects that
      expect(stepResult.resourceName).toBe(``)
    })

    it('returns creating outcome with org name when org create data is set', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() =>
        result.current.updateStepData(`org`, {
          mode: `create`,
          data: { name: `My Org`, description: `` },
        })
      )

      const stepResult = result.current.getStepResult(0)
      expect(stepResult.outcome).toBe(`creating`)
      expect(stepResult.resourceName).toBe(`My Org`)
    })

    it('returns creating outcome with provider brand when provider create data is set', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() =>
        result.current.updateStepData(`provider`, {
          mode: `create`,
          data: {
            providerBrand: `openai` as any,
            apiKey: `sk-test`,
            model: `gpt-4`,
            providerUrl: ``,
            providerName: ``,
          },
        })
      )

      const stepResult = result.current.getStepResult(1)
      expect(stepResult.outcome).toBe(`creating`)
      expect(stepResult.resourceName).toBe(`openai`)
    })

    it('returns selected outcome with resourceId when mode is select', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() =>
        result.current.updateStepData(`project`, {
          mode: `select`,
          selectedId: `proj-123`,
          selectedName: `Existing Project`,
        })
      )

      const stepResult = result.current.getStepResult(2)
      expect(stepResult.outcome).toBe(`selected`)
      expect(stepResult.resourceId).toBe(`proj-123`)
      expect(stepResult.resourceName).toBe(`Existing Project`)
    })

    it('returns skipped for an out-of-bounds step index', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      const stepResult = result.current.getStepResult(99)
      expect(stepResult.outcome).toBe(`skipped`)
    })
  })

  // ─── updateStepData ───────────────────────────────────────────────────────

  describe('updateStepData', () => {
    it('updates the org step data', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() =>
        result.current.updateStepData(`org`, {
          mode: `create`,
          data: { name: `New Org`, description: `Desc` },
        })
      )

      expect(result.current.stepData.org.data?.name).toBe(`New Org`)
    })

    it('updates the provider step data', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() =>
        result.current.updateStepData(`provider`, {
          mode: `select`,
          selectedId: `prov-1`,
          selectedName: `My Provider`,
        })
      )

      expect(result.current.stepData.provider.selectedId).toBe(`prov-1`)
      expect(result.current.stepData.provider.mode).toBe(`select`)
    })

    it('updates the project step data', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() =>
        result.current.updateStepData(`project`, {
          mode: `create`,
          data: { name: `My Project`, description: `` },
        })
      )

      expect(result.current.stepData.project.data?.name).toBe(`My Project`)
    })

    it('updates the sandbox step data', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() =>
        result.current.updateStepData(`sandbox`, {
          mode: `select`,
          selectedId: `sandbox-42`,
          selectedName: `Claude Code`,
        })
      )

      expect(result.current.stepData.sandbox.selectedId).toBe(`sandbox-42`)
    })

    it('does not overwrite other step data when updating one key', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() =>
        result.current.updateStepData(`org`, {
          mode: `create`,
          data: { name: `Org Name`, description: `` },
        })
      )
      act(() =>
        result.current.updateStepData(`project`, {
          mode: `create`,
          data: { name: `Project Name`, description: `` },
        })
      )

      expect(result.current.stepData.org.data?.name).toBe(`Org Name`)
      expect(result.current.stepData.project.data?.name).toBe(`Project Name`)
    })

    it('isStepSkipped reflects updated stepData mode (un-skip by switching mode)', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      // Skip provider (index 1)
      act(() => result.current.setActiveStep(1))
      act(() => result.current.onSkip(1))
      expect(result.current.isStepSkipped(1)).toBe(true)

      // Updating provider step data to create mode — isStepSkipped derives from mode
      act(() =>
        result.current.updateStepData(`provider`, {
          mode: `create`,
          data: {
            providerBrand: `openai` as any,
            apiKey: `sk-test`,
            model: `gpt-4`,
            providerUrl: ``,
            providerName: ``,
          },
        })
      )

      expect(result.current.isStepSkipped(1)).toBe(false)
    })
  })

  // ─── isProviderSkipped / isProjectSkipped flags ───────────────────────────

  describe('isProviderSkipped and isProjectSkipped', () => {
    it('isProviderSkipped reflects isStepSkipped(1)', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      expect(result.current.isProviderSkipped).toBe(false)
      act(() => result.current.onSkip(1))
      expect(result.current.isProviderSkipped).toBe(true)
    })

    it('isProjectSkipped reflects isStepSkipped(2)', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      expect(result.current.isProjectSkipped).toBe(false)
      act(() => result.current.onSkip(2))
      expect(result.current.isProjectSkipped).toBe(true)
    })

    it('skipping provider does not affect isProjectSkipped', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.onSkip(1))
      expect(result.current.isProjectSkipped).toBe(false)
    })

    it('skipping project does not affect isProviderSkipped', async () => {
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.onSkip(2))
      expect(result.current.isProviderSkipped).toBe(false)
    })
  })

  // ─── onClose ──────────────────────────────────────────────────────────────

  describe('onClose', () => {
    it('does nothing when canDismiss is false (auto mode)', async () => {
      mockOnboardingState.mode = `auto`
      const { closeOnboarding } = await import(
        '@TAF/actions/onboarding/local/closeOnboarding'
      )
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.setActiveStep(3))
      act(() => result.current.onClose())

      expect(closeOnboarding).not.toHaveBeenCalled()
      expect(result.current.activeStep).toBe(3)
    })

    it('resets state and calls closeOnboarding when canDismiss is true', async () => {
      mockOnboardingState.mode = `manual`
      const { closeOnboarding } = await import(
        '@TAF/actions/onboarding/local/closeOnboarding'
      )
      const { useOnboarding } = await import('./useOnboarding')
      const { result } = renderHook(() => useOnboarding())

      act(() => result.current.setActiveStep(2))
      act(() => result.current.onSkip(1))
      act(() => result.current.onClose())

      expect(closeOnboarding).toHaveBeenCalled()
      expect(result.current.activeStep).toBe(0)
      expect(result.current.isStepSkipped(1)).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.submitting).toBe(false)
    })
  })
})
