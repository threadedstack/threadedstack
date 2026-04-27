import Box from '@mui/material/Box'
import Fade from '@mui/material/Fade'
import { Text } from '@tdsk/components'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import DialogContent from '@mui/material/DialogContent'
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
      <DialogContent sx={{ p: 0, display: `flex`, height: `100%` }}>
        <WizardContainer>
          <StepperPanel>
            <Text
              variant='h6'
              sx={{ mb: 3, fontWeight: 700 }}
            >
              Setup Wizard
            </Text>
            <Box sx={{ display: `flex`, flexDirection: `column`, gap: 0.5 }}>
              {steps.map((stepName, index) => {
                if (index === steps.length - 1) return null
                const isActive = activeStep === index
                const isCompleted = activeStep > index && !isStepSkipped(index)
                const isSkipped = isStepSkipped(index)
                const isClickable = index < activeStep || isSkipped

                return (
                  <Box key={stepName}>
                    <Box
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
                              : isSkipped
                                ? `action.disabledBackground`
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
                    {index < steps.length - 2 && (
                      <Box
                        sx={{
                          width: 1,
                          height: 16,
                          bgcolor: `divider`,
                          ml: `25px`,
                        }}
                      />
                    )}
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

            {canDismiss && (
              <Box sx={{ mt: `auto`, pt: 2 }}>
                <IconButton
                  size='small'
                  onClick={onClose}
                >
                  <CloseIcon fontSize='small' />
                </IconButton>
              </Box>
            )}
          </StepperPanel>

          <ContentPanel>
            <ContentBody>
              <Fade
                in
                key={activeStep}
                timeout={200}
              >
                <Box>
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
                      stepData={stepData.project}
                      isNewOrg={isNewOrg}
                      onUpdate={(data) => updateStepData(`project`, data)}
                      onSkip={() => onSkip(2)}
                    />
                  )}
                  {activeStep === 3 && (
                    <SandboxStep
                      stepData={stepData.sandbox}
                      isNewOrg={isNewOrg}
                      isProviderSkipped={isProviderSkipped}
                      isProjectSkipped={isProjectSkipped}
                      onUpdate={(data) => updateStepData(`sandbox`, data)}
                      onSkip={() => onSkip(3)}
                    />
                  )}
                  {activeStep === 4 && (
                    <ReviewStep
                      error={error}
                      submitStep={submitStep}
                      getStepResult={getStepResult}
                      onStepClick={onStepClick}
                    />
                  )}
                </Box>
              </Fade>
            </ContentBody>

            <ContentFooter>
              <Button
                variant='outlined'
                disabled={isFirstStep || submitting}
                onClick={onBack}
              >
                Back
              </Button>
              <Box sx={{ display: `flex`, gap: 1 }}>
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
      </DialogContent>
    </Dialog>
  )
}
