import Box from '@mui/material/Box'
import Fade from '@mui/material/Fade'
import { Text } from '@tdsk/components'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import { OrgStep } from '@TAF/components/Onboarding/steps/OrgStep'
import { useOnboarding } from '@TAF/hooks/components/useOnboarding'
import { ReviewStep } from '@TAF/components/Onboarding/steps/ReviewStep'
import { ProjectStep } from '@TAF/components/Onboarding/steps/ProjectStep'
import { SandboxStep } from '@TAF/components/Onboarding/steps/SandboxStep'
import { ProviderStep } from '@TAF/components/Onboarding/steps/ProviderStep'
import {
  Close as CloseIcon,
  Check as CheckIcon,
  SkipNext as SkipIcon,
} from '@mui/icons-material'
import {
  ContentBody,
  StepperPanel,
  ContentPanel,
  ContentFooter,
  WizardContainer,
  WizardDialogContent,
} from '@TAF/components/Onboarding/OnboardingWizard.styled'

export const OnboardingWizard = () => {
  const {
    steps,
    error,
    onBack,
    onNext,
    onSkip,
    onClose,
    onSubmit,
    stepData,
    submitting,
    submitStep,
    activeStep,
    canDismiss,
    onboarding,
    isFirstStep,
    isReviewStep,
    onStepClick,
    isStepSkipped,
    getStepResult,
    updateStepData,
    returnToReview,
    onReturnToReview,
    isProviderSkipped,
    isProjectSkipped,
  } = useOnboarding()

  const isNewOrg = stepData.org.mode === `create`

  const canNext = (() => {
    switch (activeStep) {
      case 0:
        return stepData.org.mode === `select`
          ? !!stepData.org.selectedId
          : !!stepData.org.data?.name?.trim()
      case 1:
        if (stepData.provider.mode === `skip`) return true
        return stepData.provider.mode === `select`
          ? !!stepData.provider.selectedId
          : !!(
              stepData.provider.data?.providerBrand &&
              stepData.provider.data?.apiKey?.trim()
            )
      case 2:
        if (stepData.project.mode === `skip`) return true
        return stepData.project.mode === `select`
          ? !!stepData.project.selectedId
          : !!stepData.project.data?.name?.trim()
      case 3:
        return true
      case 4:
        return true
      default:
        return false
    }
  })()

  return (
    <Dialog
      open={onboarding.open}
      onClose={canDismiss ? onClose : undefined}
      disableEscapeKeyDown={!canDismiss}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: `75vw`,
          height: `80vh`,
          maxWidth: 900,
          maxHeight: 700,
        },
      }}
    >
      <WizardDialogContent>
        <WizardContainer className='tdsk-sw-container'>
          <StepperPanel className='tdsk-sw-step-panel'>
            <Box
              className='tdsk-sw-side-header'
              sx={{
                display: `flex`,
                justifyContent: `space-between`,
                alignItems: `center`,
                mb: 3,
              }}
            >
              <Text
                variant='h6'
                sx={{ fontWeight: 700 }}
              >
                Setup Wizard
              </Text>
              {canDismiss && (
                <IconButton
                  size='small'
                  onClick={onClose}
                  aria-label='Close wizard'
                >
                  <CloseIcon fontSize='small' />
                </IconButton>
              )}
            </Box>
            <Box
              className='tdsk-sw-side-steps-container'
              sx={{ display: `flex`, flexDirection: `column`, gap: 0.5 }}
            >
              {steps.map((stepName, index) => {
                if (index === steps.length - 1) return null
                const isActive = activeStep === index
                const isCompleted = activeStep > index && !isStepSkipped(index)
                const isSkipped = isStepSkipped(index)
                const isClickable = index < activeStep || isSkipped

                return (
                  <Box
                    key={stepName}
                    className='tdsk-sw-step-box'
                  >
                    <Box
                      className='tdsk-sw-side-step-nav-item'
                      onClick={() => isClickable && onStepClick(index)}
                      sx={{
                        display: `flex`,
                        alignItems: `center`,
                        gap: 1.5,
                        py: 1,
                        px: 1.5,
                        borderRadius: 1,
                        cursor: isClickable ? `pointer` : `default`,
                        bgcolor: isActive ? `action.selected` : `transparent`,
                        '&:hover': isClickable ? { bgcolor: `action.hover` } : {},
                      }}
                    >
                      <Box
                        className='tdsk-sw-step-nav-item-state'
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: `50%`,
                          display: `flex`,
                          alignItems: `center`,
                          justifyContent: `center`,
                          fontSize: 12,
                          fontWeight: 600,
                          bgcolor: isActive
                            ? `primary.main`
                            : isCompleted
                              ? `success.main`
                              : `action.disabledBackground`,
                          color:
                            isActive || isCompleted
                              ? `primary.contrastText`
                              : `text.disabled`,
                        }}
                      >
                        {isCompleted ? (
                          <CheckIcon sx={{ fontSize: 16 }} />
                        ) : isSkipped ? (
                          <SkipIcon sx={{ fontSize: 16 }} />
                        ) : (
                          index + 1
                        )}
                      </Box>
                      <Text
                        variant='body2'
                        sx={{
                          fontWeight: isActive ? 600 : 400,
                          color: isActive
                            ? `text.primary`
                            : isSkipped
                              ? `text.disabled`
                              : `text.secondary`,
                        }}
                      >
                        {stepName}
                      </Text>
                    </Box>
                  </Box>
                )
              })}

              <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: `divider` }}>
                <Box
                  onClick={() =>
                    activeStep >= steps.length - 2 && onStepClick(steps.length - 1)
                  }
                  sx={{
                    display: `flex`,
                    alignItems: `center`,
                    gap: 1.5,
                    py: 1,
                    px: 1.5,
                    borderRadius: 1,
                    cursor: isReviewStep
                      ? `default`
                      : activeStep >= steps.length - 2
                        ? `pointer`
                        : `default`,
                    bgcolor: isReviewStep ? `action.selected` : `transparent`,
                  }}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: `50%`,
                      display: `flex`,
                      alignItems: `center`,
                      justifyContent: `center`,
                      fontSize: 12,
                      fontWeight: 600,
                      bgcolor: isReviewStep
                        ? `primary.main`
                        : `action.disabledBackground`,
                      color: isReviewStep ? `primary.contrastText` : `text.disabled`,
                    }}
                  >
                    {steps.length}
                  </Box>
                  <Text
                    variant='body2'
                    sx={{
                      fontWeight: isReviewStep ? 600 : 400,
                      color: isReviewStep ? `text.primary` : `text.secondary`,
                    }}
                  >
                    Review
                  </Text>
                </Box>
              </Box>
            </Box>
          </StepperPanel>

          <ContentPanel className='tdsk-sw-content-panel'>
            <ContentBody className='tdsk-sw-content-body'>
              <Fade
                in
                key={activeStep}
                timeout={200}
              >
                <Box className='tdsk-sw-content-panel-box'>
                  {activeStep === 0 && (
                    <OrgStep
                      stepData={stepData.org}
                      preSelectedOrgId={onboarding.orgId}
                      onUpdate={(data) => updateStepData(`org`, data)}
                    />
                  )}
                  {activeStep === 1 && (
                    <ProviderStep
                      stepData={stepData.provider}
                      onUpdate={(data) => updateStepData(`provider`, data)}
                      onSkip={() => onSkip(1)}
                    />
                  )}
                  {activeStep === 2 && (
                    <ProjectStep
                      isNewOrg={isNewOrg}
                      onSkip={() => onSkip(2)}
                      stepData={stepData.project}
                      onUpdate={(data) => updateStepData(`project`, data)}
                    />
                  )}
                  {activeStep === 3 && (
                    <SandboxStep
                      isNewOrg={isNewOrg}
                      onSkip={() => onSkip(3)}
                      stepData={stepData.sandbox}
                      isProjectSkipped={isProjectSkipped}
                      isProviderSkipped={isProviderSkipped}
                      orgId={onboarding.orgId || stepData.org.selectedId}
                      onUpdate={(data) => updateStepData(`sandbox`, data)}
                    />
                  )}
                  {activeStep === 4 && (
                    <ReviewStep
                      error={error}
                      submitStep={submitStep}
                      onStepClick={onStepClick}
                      getStepResult={getStepResult}
                    />
                  )}
                </Box>
              </Fade>
            </ContentBody>

            <ContentFooter className='tdsk-sw-content-footer'>
              <Button
                variant='outlined'
                disabled={isFirstStep || submitting}
                onClick={onBack}
              >
                Back
              </Button>
              <Box sx={{ display: `flex`, gap: 1 }}>
                {!isReviewStep && returnToReview && (
                  <Button
                    variant='outlined'
                    onClick={onReturnToReview}
                  >
                    Return to Review
                  </Button>
                )}
                {isReviewStep ? (
                  <Button
                    variant='contained'
                    disabled={submitting}
                    onClick={onSubmit}
                    startIcon={submitting ? <CircularProgress size={16} /> : undefined}
                  >
                    {submitting ? `Setting up...` : `Finish`}
                  </Button>
                ) : (
                  <Button
                    variant='contained'
                    disabled={!canNext}
                    onClick={onNext}
                  >
                    Next
                  </Button>
                )}
              </Box>
            </ContentFooter>
          </ContentPanel>
        </WizardContainer>
      </WizardDialogContent>
    </Dialog>
  )
}
