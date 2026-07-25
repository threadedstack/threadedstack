import type { TStepResult, TOnboardingCompletion } from '@TAF/types'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import { Text } from '@tdsk/components'
import { OnboardingSteps } from '@TAF/constants/onboarding'
import { ResourceChoiceCard } from '@TAF/components/Onboarding/OnboardingWizard.styled'
import {
  Cloud as ProviderIcon,
  CheckCircle as DoneIcon,
  Business as OrgIcon,
  Terminal as SandboxIcon,
  FolderOpen as ProjectIcon,
} from '@mui/icons-material'

export type TReviewStep = {
  error: string | null
  submitStep: number | null
  onGoToProject: () => void
  onCreateFunction: () => void
  onCreateEndpoint: () => void
  onStepClick: (stepIndex: number) => void
  getStepResult: (stepIndex: number) => TStepResult
  completion: TOnboardingCompletion | null
}

const StepIcons = [OrgIcon, ProviderIcon, ProjectIcon, SandboxIcon]

export const ReviewStep = (props: TReviewStep) => {
  const {
    error,
    completion,
    submitStep,
    onGoToProject,
    getStepResult,
    onCreateFunction,
    onCreateEndpoint,
    onStepClick,
  } = props

  if (completion)
    return (
      <Box sx={{ textAlign: `center`, py: 4 }}>
        <DoneIcon sx={{ fontSize: 56, color: `success.main`, mb: 2 }} />
        <Text
          variant='h6'
          gutterBottom
        >
          You're all set
        </Text>
        <Text
          color='text.secondary'
          sx={{ mb: 4 }}
        >
          Your organization and project are ready. Deploy your first Function or Endpoint
          to start building.
        </Text>
        <Box
          sx={{
            display: `flex`,
            justifyContent: `center`,
            gap: 2,
            mb: 3,
            flexWrap: `wrap`,
          }}
        >
          <Button
            variant='contained'
            onClick={onCreateFunction}
          >
            Create a Function
          </Button>
          <Button
            variant='contained'
            onClick={onCreateEndpoint}
          >
            Create an Endpoint
          </Button>
        </Box>
        <Button
          variant='text'
          onClick={onGoToProject}
        >
          Go to project
        </Button>
      </Box>
    )

  return (
    <Box>
      <Text
        variant='h6'
        gutterBottom
      >
        Review & Finish
      </Text>
      <Text
        color='text.secondary'
        sx={{ mb: 3 }}
      >
        Review your setup before creating resources. Click any item to go back and edit.
      </Text>

      {error && (
        <Alert
          severity='error'
          sx={{ mb: 2 }}
        >
          {error}
          {submitStep !== null && (
            <Text
              variant='body2'
              sx={{ mt: 0.5 }}
            >
              Failed at step: {OnboardingSteps[submitStep]}
            </Text>
          )}
        </Alert>
      )}

      <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1.5 }}>
        {OnboardingSteps.slice(0, 4).map((stepName, index) => {
          const result = getStepResult(index)
          const Icon = StepIcons[index]
          const isSkipped = result.outcome === `skipped`

          return (
            <ResourceChoiceCard
              key={stepName}
              onClick={() => onStepClick(index)}
              sx={{
                opacity: isSkipped ? 0.5 : 1,
                cursor: `pointer`,
                display: `flex`,
                alignItems: `center`,
                gap: 2,
              }}
            >
              {Icon && (
                <Icon sx={{ color: isSkipped ? `text.disabled` : `primary.main` }} />
              )}
              <Box sx={{ flex: 1 }}>
                <Text
                  variant='subtitle2'
                  fontWeight={600}
                >
                  {stepName}
                </Text>
                <Text
                  variant='body2'
                  color='text.secondary'
                >
                  {result.outcome === `creating` &&
                    `Creating: ${result.resourceName || `New ${stepName.toLowerCase()}`}`}
                  {result.outcome === `selected` &&
                    `Using: ${result.resourceName || `Existing ${stepName.toLowerCase()}`}`}
                  {result.outcome === `skipped` && `Skipped`}
                </Text>
              </Box>
              <Chip
                size='small'
                label={
                  result.outcome === `creating`
                    ? `New`
                    : result.outcome === `selected`
                      ? `Existing`
                      : `Skipped`
                }
                color={
                  isSkipped
                    ? `default`
                    : result.outcome === `creating`
                      ? `primary`
                      : `success`
                }
                variant={isSkipped ? `outlined` : `filled`}
              />
            </ResourceChoiceCard>
          )
        })}
      </Box>
    </Box>
  )
}
