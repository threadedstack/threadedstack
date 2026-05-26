import type { TOnboardingStepData } from '@TAF/types'

import { useEffect } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import { Text } from '@tdsk/components'
import { SandboxPresets } from '@tdsk/domain'
import { useOrgSandboxes } from '@TAF/state/selectors'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import {
  SkipWarning,
  ResourceChoiceCard,
} from '@TAF/components/Onboarding/OnboardingWizard.styled'

export type TSandboxStep = {
  orgId?: string
  onSkip: () => void
  isNewOrg?: boolean
  isProviderSkipped: boolean
  isProjectSkipped: boolean
  stepData: TOnboardingStepData['sandbox']
  onUpdate: (data: TOnboardingStepData['sandbox']) => void
}

const SBPresets = Object.entries(SandboxPresets)

export const SandboxStep = (props: TSandboxStep) => {
  const { onSkip, stepData, isNewOrg, onUpdate, isProjectSkipped, isProviderSkipped } =
    props

  const [sandboxes] = useOrgSandboxes()
  const bothSkipped = isProviderSkipped && isProjectSkipped
  const sandboxesArray = sandboxes ? Object.values(sandboxes) : []

  useEffect(() => {
    if (bothSkipped && stepData.mode !== `skip`) {
      onUpdate({ mode: `skip` })
    }
  }, [bothSkipped, stepData.mode, onUpdate])

  if (isNewOrg && sandboxesArray.length === 0) {
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
          Select a sandbox to link with your project after setup
        </Text>

        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1 }}>
          {SBPresets.map(([runtime, preset]) => (
            <ResourceChoiceCard
              key={runtime}
              selected={stepData.selectedName === preset.name}
              onClick={() =>
                onUpdate({
                  mode: `select`,
                  selectedId: runtime,
                  selectedName: preset.name,
                })
              }
            >
              <Box sx={{ display: `flex`, alignItems: `center`, gap: 1 }}>
                <Text
                  variant='subtitle1'
                  fontWeight={600}
                >
                  {preset.name}
                </Text>
                <Chip
                  label='Built-in'
                  size='small'
                  variant='outlined'
                />
              </Box>
              <Text
                variant='body2'
                color='text.secondary'
              >
                {preset.description}
              </Text>
            </ResourceChoiceCard>
          ))}
        </Box>

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
          No sandboxes found for this organization. You can configure sandboxes from the
          Sandboxes page.
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
