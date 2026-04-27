import type { TStepResult } from '@TAF/types'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import { Text } from '@tdsk/components'
import { OnboardingSteps } from '@TAF/constants/onboarding'
import { ResourceChoiceCard } from '@TAF/components/Onboarding/OnboardingWizard.styled'
import {
  Business as OrgIcon,
  Cloud as ProviderIcon,
  Terminal as SandboxIcon,
  FolderOpen as ProjectIcon,
} from '@mui/icons-material'

export type TReviewStep = {
  error: string | null
  submitStep: number | null
  onStepClick: (stepIndex: number) => void
  getStepResult: (stepIndex: number) => TStepResult
}

const StepIcons = [OrgIcon, ProviderIcon, ProjectIcon, SandboxIcon]

export const ReviewStep = (props: TReviewStep) => {
  const { error, submitStep, getStepResult, onStepClick } = props

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
