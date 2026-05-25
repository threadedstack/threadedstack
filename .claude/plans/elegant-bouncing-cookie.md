# Setup Wizard Fix Plan

## Context

The Setup Wizard has multiple critical bugs affecting both entry points: auto-mode (Home page, no orgs) and manual-mode (Org page, existing org). The most severe is that opening the wizard from the Org detail page (with a pre-selected orgId and startStep=1) causes submission to attempt creating an org with an empty name instead of using the existing one. Additionally, the provider API key is collected but silently discarded during submission, users with existing resources don't see the create/select choice cards, and sandbox step data can get stuck in an inconsistent state.

## Files to Modify

- `repos/admin/src/hooks/components/useOnboarding.ts` (main orchestration hook)
- `repos/admin/src/components/Onboarding/OnboardingWizard.tsx` (main wizard component)
- `repos/admin/src/components/Onboarding/OnboardingWizard.styled.tsx` (styled components)
- `repos/admin/src/components/Onboarding/steps/OrgStep.tsx`
- `repos/admin/src/components/Onboarding/steps/ProviderStep.tsx`
- `repos/admin/src/components/Onboarding/steps/ProjectStep.tsx`
- `repos/admin/src/components/Onboarding/steps/SandboxStep.tsx`
- `repos/admin/src/types/onboarding.types.ts`

---

## Phase 1: Critical Bugs (useOnboarding.ts)

### 1A. Pre-selected org not initialized in stepData

**Problem**: When wizard opens from Org page with `{ orgId: org.id, startStep: 1 }`, the useEffect (line 32) resets stepData to `DefStepData` which sets `org.mode = 'create'` with empty name. Then `onSubmit` (line 151) sees `stepData.org.mode === 'create'` and calls `createOrg({ name: '' })`, which fails. ReviewStep also shows "Creating: " (empty) instead of "Using: OrgName".

**Fix in `useOnboarding.ts`**:
1. Import `getOrgs` from `@TAF/state/accessors`
2. In the useEffect that runs on open (lines 32-40), detect `onboarding.orgId` and initialize stepData.org to select mode:

```typescript
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
          mode: 'select',
          selectedId: onboarding.orgId,
          selectedName: org?.name || '',
        },
      }
    }
    setStepData(initialStepData)

    setError(null)
    setSubmitting(false)
    setSubmitStep(null)
  }
}, [onboarding.open, onboarding.startStep, onboarding.orgId])
```

3. Add defensive guard in `onSubmit` (line 151) to skip org creation when orgId is pre-set:

```typescript
if (!onboarding.orgId && stepData.org.mode === 'create' && stepData.org.data) {
```

### 1B. API key collected but not passed to createProvider

**Problem**: ProviderStep collects `apiKey` and `model` from the user. `onSubmit` only passes `{ name, type, orgId, brand, options }` to `createProvider()`. The apiKey is silently discarded. The provider is created without credentials.

**Fix in `useOnboarding.ts`**: After provider creation succeeds (after line 209), follow the ProviderDrawer pattern (lines 326-362 of `ProviderDrawer.tsx`):

1. Add imports:
```typescript
import { createSecret } from '@TAF/actions/secrets/api/createSecret'
import { updateProvider } from '@TAF/actions/providers/api/updateProvider'
import { AIProviderTemplates } from '@tdsk/domain'
```

2. After the `setStepData` call that reflects the created provider, add:
```typescript
const apiKey = stepData.provider.data?.apiKey?.trim()
if (apiKey && providerId) {
  const brand = stepData.provider.data?.providerBrand
  const template = brand
    ? AIProviderTemplates[brand as keyof typeof AIProviderTemplates]
    : undefined
  const secretName =
    template?.defaultSecretName ||
    `${(stepData.provider.data?.providerName || brand || 'PROVIDER').toUpperCase().replace(/\s+/g, '_')}_API_KEY`

  const secretResult = await createSecret({
    orgId,
    name: secretName,
    value: apiKey,
    providerId,
  })

  if (secretResult.data?.id) {
    await updateProvider({
      orgId,
      id: providerId,
      data: { secretId: secretResult.data.id },
    })
  }
}
```

Note: Follow ProviderDrawer's pattern exactly. Non-fatal if secret creation fails since the provider itself was created. The user can add the secret later from the Providers page.

---

## Phase 2: UX Bugs (Step Components)

### 2A. showChoice never true on first render

**Problem**: `DefStepData` sets all modes to `'create'`. The showChoice initializer checks `stepData.mode !== 'create'` which is always false. Users with existing resources see the create form instead of the create/select choice cards.

**Fix**: Change the showChoice condition in OrgStep, ProviderStep, and ProjectStep to check whether the user has actively configured the step (non-empty data) rather than just checking the mode.

**OrgStep.tsx** (line 22-27): Change to:
```typescript
const [showChoice, setShowChoice] = useState(
  hasExisting &&
    !preSelectedOrgId &&
    !(stepData.mode === 'select' && stepData.selectedId) &&
    !(stepData.mode === 'create' && stepData.data?.name?.trim())
)
```

**ProviderStep.tsx** (line 33-35): Change to:
```typescript
const [showChoice, setShowChoice] = useState(
  hasExisting &&
    stepData.mode !== 'skip' &&
    !(stepData.mode === 'select' && stepData.selectedId) &&
    !(stepData.mode === 'create' && stepData.data?.providerBrand)
)
```

**ProjectStep.tsx** (line 27-29): Change to:
```typescript
const [showChoice, setShowChoice] = useState(
  hasExisting &&
    stepData.mode !== 'skip' &&
    !(stepData.mode === 'select' && stepData.selectedId) &&
    !(stepData.mode === 'create' && stepData.data?.name?.trim())
)
```

Logic: show choice when there ARE existing resources AND the user hasn't made a meaningful selection or started entering create data. On re-visit after configuring, the data fields will be populated, so showChoice defaults to false (showing the configured view).

### 2B. Sandbox bothSkipped doesn't set skip mode

**Problem**: When both provider and project are skipped, SandboxStep shows a warning but doesn't set `stepData.sandbox.mode = 'skip'`. ReviewStep shows "Creating: undefined" instead of "Skipped".

**Fix in `SandboxStep.tsx`**: Add a useEffect to auto-skip:

```typescript
useEffect(() => {
  if (bothSkipped && stepData.mode !== 'skip') {
    onUpdate({ mode: 'skip' })
  }
}, [bothSkipped, stepData.mode, onUpdate])
```

Also add `onUpdate` to the SandboxStep props type signature (it's already in TSandboxStep, just need to reference it from props).

### 2C. Skip button inconsistently available

**Problem**: In ProviderStep and ProjectStep, skip is only available in the showChoice view or when `!hasExisting` in the create view. Not available at all in select view.

**Fix**:
- **ProviderStep.tsx**: Remove `!hasExisting &&` guards from lines 269 and 280. Add skip button to the select view (after the provider list, before the closing `</Box>`).
- **ProjectStep.tsx**: Same pattern. Remove `!hasExisting &&` guards from lines 216 and 228. Add skip button to the select view.
- Remove `SkipWarning` from the `showChoice` views in both components (it's premature; the warning should only appear once the user is actively in create mode without existing resources).

---

## Phase 3: Return to Review (useOnboarding + OnboardingWizard)

### 3A. Add returnToReview state

**Problem**: When user clicks a step in ReviewStep to edit, they must click Next through all subsequent steps to return. No shortcut.

**Fix in `useOnboarding.ts`**:
1. Add state: `const [returnToReview, setReturnToReview] = useState(false)`
2. In `onStepClick`, track when navigating away from review:
```typescript
if (isReviewStep && stepIndex < activeStep) {
  setReturnToReview(true)
}
```
3. Add callback:
```typescript
const onReturnToReview = useCallback(() => {
  setReturnToReview(false)
  setActiveStep(steps.length - 1)
}, [steps.length])
```
4. Clear `returnToReview` in `onClose` and in the useEffect reset
5. Export `returnToReview` and `onReturnToReview`

**Fix in `OnboardingWizard.tsx`**: In the ContentFooter, when `returnToReview` is true and not on review step, show a "Return to Review" button:
```typescript
{!isReviewStep && returnToReview && (
  <Button variant='outlined' onClick={onReturnToReview}>
    Return to Review
  </Button>
)}
```

---

## Phase 4: Style Fixes

### 4A. Connector line alignment (OnboardingWizard.tsx line 183)
Change `ml: '25px'` to `ml: '26px'` to center under the 28px circle (12px padding + 14px half-width).

### 4B. Close button placement (OnboardingWizard.tsx lines 241-250)
Move the close button from `mt: 'auto'` (bottom of stepper) to inline with the "Setup Wizard" heading. Replace the heading Text + close button block with:
```typescript
<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
  <Text variant='h6' sx={{ fontWeight: 700 }}>Setup Wizard</Text>
  {canDismiss && (
    <IconButton size='small' onClick={onClose} aria-label='Close wizard'>
      <CloseIcon fontSize='small' />
    </IconButton>
  )}
</Box>
```
Remove the old close button block at the bottom.

### 4C. DialogContent inline styles (OnboardingWizard.tsx line 98)
Move `sx={{ p: 0, display: 'flex', height: '100%' }}` to a styled component `WizardDialogContent` in the styled file.

### 4D. ResourceChoiceCard focus-visible (OnboardingWizard.styled.tsx)
Add focus-visible styles:
```typescript
'&:focus-visible': {
  outline: `2px solid ${theme.palette.primary.main}`,
  outlineOffset: 2,
},
```

---

## Phase 5: Minor Fixes

### 5A. Sandbox type cleanup (onboarding.types.ts)
Change `TOnboardingSandboxData = { sandboxId: string }` to `TOnboardingSandboxData = Record<string, never>` since the sandboxId field is never read. Update DefStepData's sandbox default to use `data: {} as TOnboardingSandboxData`.

### 5B. getStepResult sandbox case (useOnboarding.ts line 128-129)
For `key === 'sandbox'` in create mode, return `undefined` for the name since sandbox is select-only.

### 5C. Query params leak (useOnboarding.ts onSubmit finally block)
Before `nav.to()`, clear stale params:
```typescript
if (succeeded) {
  closeOnboarding()
  history.replaceState({}, '', window.location.pathname)
  if (projectId && orgId) nav.to(`/orgs/${orgId}/projects/${projectId}`)
  else if (orgId) nav.to(`/orgs/${orgId}`)
}
```

---

## Verification

1. `cd repos/admin && pnpm types` - Type checks pass
2. `cd repos/admin && pnpm test` - Unit tests pass
3. Start admin dev server (`cd repos/admin && pnpm start`)
4. Test auto-mode: Clear orgs (or use fresh account), navigate to `/`, wizard should auto-open at step 0
5. Test manual-mode from Org page: Navigate to `/orgs/:orgId`, click "Setup Wizard" action card, wizard should open at step 1 with org pre-selected and shown as "Using: OrgName" in Review
6. Test choice cards: With existing resources, each step should show create/select choice first
7. Test skip flow: Skip provider and project, verify sandbox auto-skips and Review shows "Skipped" for all three
8. Test return-to-review: On Review step, click a step to edit, verify "Return to Review" button appears
9. Test provider creation: Create a new provider with API key, verify the secret is created and linked (check Providers page after wizard completes)
