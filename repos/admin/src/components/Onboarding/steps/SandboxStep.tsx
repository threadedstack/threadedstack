import type { TOnboardingStepData } from '@TAF/types'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import { Text } from '@tdsk/components'
import { useOrgSandboxes } from '@TAF/state/selectors'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import {
  ResourceChoiceCard,
  SkipWarning,
} from '@TAF/components/Onboarding/OnboardingWizard.styled'

export type TSandboxStep = {
  onSkip: () => void
  isNewOrg?: boolean
  isProviderSkipped: boolean
  isProjectSkipped: boolean
  stepData: TOnboardingStepData['sandbox']
  onUpdate: (data: TOnboardingStepData['sandbox']) => void
}

export const SandboxStep = (props: TSandboxStep) => {
  const { stepData, isNewOrg, isProviderSkipped, isProjectSkipped, onUpdate, onSkip } =
    props
  const [sandboxes] = useOrgSandboxes()
  const sandboxesArray = sandboxes ? Object.values(sandboxes) : []

  const bothSkipped = isProviderSkipped && isProjectSkipped

  if (isNewOrg && sandboxesArray.length === 0) {
    return (
      <Box>
        <Text
          variant='h6'
          gutterBottom
        >
          Sandbox
        </Text>
        <Alert
          severity='info'
          sx={{ mt: 2 }}
        >
          Your organization's built-in sandboxes will be linked during setup. You can
          configure sandbox linking later from the Sandboxes page.
        </Alert>
        <Box sx={{ mt: 3, display: `flex`, justifyContent: `flex-end` }}>
          <Button
            size='small'
            color='warning'
            onClick={onSkip}
          >
            Skip this step
          </Button>
        </Box>
      </Box>
    )
  }

  if (bothSkipped) {
    return (
      <Box>
        <Text
          variant='h6'
          gutterBottom
        >
          Sandbox
        </Text>
        <Alert
          severity='warning'
          sx={{ mt: 2 }}
        >
          Provider and Project are required to configure a sandbox. You can set this up
          later from the Sandboxes page after creating a provider and project.
        </Alert>
      </Box>
    )
  }

  const partialWarning = isProviderSkipped
    ? `Provider was skipped — this sandbox won't be linked to a provider.`
    : isProjectSkipped
      ? `Project was skipped — this sandbox won't be linked to a project.`
      : null

  return (
    <Box>
      <Text
        variant='h6'
        gutterBottom
      >
        Sandbox
      </Text>
      <Text
        color='text.secondary'
        sx={{ mb: 2 }}
      >
        Select a sandbox to link with your provider and project
      </Text>

      {partialWarning && (
        <SkipWarning sx={{ mb: 2 }}>
          <WarningAmberIcon sx={{ color: `warning.main`, fontSize: 18, mt: 0.25 }} />
          <Text
            variant='body2'
            color='text.secondary'
          >
            {partialWarning}
          </Text>
        </SkipWarning>
      )}

      <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1 }}>
        {sandboxesArray.map((sb) => (
          <ResourceChoiceCard
            key={sb.id}
            selected={stepData.selectedId === sb.id}
            onClick={() =>
              onUpdate({ mode: `select`, selectedId: sb.id, selectedName: sb.name })
            }
          >
            <Box sx={{ display: `flex`, alignItems: `center`, gap: 1 }}>
              <Text
                variant='subtitle1'
                fontWeight={600}
              >
                {sb.name}
              </Text>
              {sb.builtIn && (
                <Chip
                  label='Built-in'
                  size='small'
                  variant='outlined'
                />
              )}
            </Box>
            {sb.config?.runtime && (
              <Text
                variant='body2'
                color='text.secondary'
              >
                Runtime: {sb.config.runtime}
              </Text>
            )}
          </ResourceChoiceCard>
        ))}
      </Box>

      {sandboxesArray.length === 0 && (
        <Text
          color='text.secondary'
          sx={{ mt: 2, textAlign: `center` }}
        >
          No sandboxes available. They will be created when the organization is set up.
        </Text>
      )}

      <Box sx={{ mt: 3, display: `flex`, justifyContent: `flex-end` }}>
        <Button
          size='small'
          color='warning'
          onClick={onSkip}
        >
          Skip this step
        </Button>
      </Box>
    </Box>
  )
}
