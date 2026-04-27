import type { TOnboardingStepData } from '@TAF/types'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import { useState, useCallback } from 'react'
import { Text, TextInput } from '@tdsk/components'
import { useProjects } from '@TAF/state/selectors'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import {
  ResourceChoiceCard,
  SkipWarning,
} from '@TAF/components/Onboarding/OnboardingWizard.styled'

export type TProjectStep = {
  onSkip: () => void
  isNewOrg?: boolean
  stepData: TOnboardingStepData['project']
  onUpdate: (data: TOnboardingStepData['project']) => void
}

export const ProjectStep = (props: TProjectStep) => {
  const { stepData, onUpdate, onSkip, isNewOrg } = props
  const [projects] = useProjects()
  const projectsArray = projects ? Object.values(projects) : []
  const hasExisting = !isNewOrg && projectsArray.length > 0

  const [showChoice, setShowChoice] = useState(
    hasExisting && stepData.mode !== `create` && stepData.mode !== `select`
  )

  const onSelectMode = useCallback(
    (mode: 'create' | 'select') => {
      setShowChoice(false)
      if (mode === `create`)
        onUpdate({ mode: `create`, data: { name: ``, description: `` } })
      else onUpdate({ mode: `select`, selectedId: ``, selectedName: `` })
    },
    [onUpdate]
  )

  const onBackToChoice = useCallback(() => {
    setShowChoice(true)
    onUpdate({ mode: `create`, data: { name: ``, description: `` } })
  }, [onUpdate])

  if (showChoice) {
    return (
      <Box>
        <Text
          variant='h6'
          gutterBottom
        >
          Project
        </Text>
        <Text
          color='text.secondary'
          sx={{ mb: 3 }}
        >
          Create a project to organize your sandboxes, endpoints, and agents
        </Text>
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
          <ResourceChoiceCard onClick={() => onSelectMode(`create`)}>
            <Text
              variant='subtitle1'
              fontWeight={600}
            >
              Create a new project
            </Text>
            <Text
              variant='body2'
              color='text.secondary'
            >
              Start a new project for your work
            </Text>
          </ResourceChoiceCard>
          <ResourceChoiceCard onClick={() => onSelectMode(`select`)}>
            <Text
              variant='subtitle1'
              fontWeight={600}
            >
              Use an existing project
            </Text>
            <Text
              variant='body2'
              color='text.secondary'
            >
              Select from your {projectsArray.length} project
              {projectsArray.length !== 1 ? `s` : ``}
            </Text>
          </ResourceChoiceCard>
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
        <SkipWarning>
          <WarningAmberIcon sx={{ color: `warning.main`, fontSize: 18, mt: 0.25 }} />
          <Text
            variant='body2'
            color='text.secondary'
          >
            Projects are required to organize your sandboxes, endpoints, and agents. You
            can create one later from the Projects page.
          </Text>
        </SkipWarning>
      </Box>
    )
  }

  if (stepData.mode === `select`) {
    return (
      <Box>
        <Box
          sx={{
            display: `flex`,
            alignItems: `center`,
            justifyContent: `space-between`,
            mb: 2,
          }}
        >
          <Text variant='h6'>Select Project</Text>
          <Button
            size='small'
            onClick={onBackToChoice}
          >
            Back
          </Button>
        </Box>
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1 }}>
          {projectsArray.map((proj) => (
            <ResourceChoiceCard
              key={proj.id}
              selected={stepData.selectedId === proj.id}
              onClick={() =>
                onUpdate({ mode: `select`, selectedId: proj.id, selectedName: proj.name })
              }
            >
              <Text
                variant='subtitle1'
                fontWeight={600}
              >
                {proj.name}
              </Text>
              {proj.description && (
                <Text
                  variant='body2'
                  color='text.secondary'
                >
                  {proj.description}
                </Text>
              )}
            </ResourceChoiceCard>
          ))}
        </Box>
      </Box>
    )
  }

  return (
    <Box>
      <Box
        sx={{
          display: `flex`,
          alignItems: `center`,
          justifyContent: `space-between`,
          mb: 2,
        }}
      >
        <Text variant='h6'>Create Project</Text>
        {hasExisting && (
          <Button
            size='small'
            onClick={onBackToChoice}
          >
            Back
          </Button>
        )}
      </Box>
      <Text
        color='text.secondary'
        sx={{ mb: 3 }}
      >
        Projects organize your sandboxes, endpoints, and agents
      </Text>
      <TextInput
        id='project-name'
        fullWidth
        required
        label='Project name'
        value={stepData.data?.name || ``}
        onChange={(e) =>
          onUpdate({
            mode: `create`,
            data: { name: e.target.value, description: stepData.data?.description || `` },
          })
        }
      />
      <TextInput
        id='project-description'
        fullWidth
        textarea
        label='Description (optional)'
        value={stepData.data?.description || ``}
        onChange={(e) =>
          onUpdate({
            mode: `create`,
            data: { name: stepData.data?.name || ``, description: e.target.value },
          })
        }
      />
      {!hasExisting && (
        <Box sx={{ mt: 2, display: `flex`, justifyContent: `flex-end` }}>
          <Button
            size='small'
            color='warning'
            onClick={onSkip}
          >
            Skip this step
          </Button>
        </Box>
      )}
      {!hasExisting && (
        <SkipWarning>
          <WarningAmberIcon sx={{ color: `warning.main`, fontSize: 18, mt: 0.25 }} />
          <Text
            variant='body2'
            color='text.secondary'
          >
            Projects are required to organize your sandboxes, endpoints, and agents. You
            can create one later from the Projects page.
          </Text>
        </SkipWarning>
      )}
    </Box>
  )
}
