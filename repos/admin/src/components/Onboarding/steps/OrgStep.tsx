import type { TOnboardingStepData } from '@TAF/types'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import { useState, useCallback } from 'react'
import { useOrgs } from '@TAF/state/selectors'
import { Text, TextInput } from '@tdsk/components'
import { ResourceChoiceCard } from '@TAF/components/Onboarding/OnboardingWizard.styled'

export type TOrgStep = {
  preSelectedOrgId?: string
  stepData: TOnboardingStepData['org']
  onUpdate: (data: TOnboardingStepData['org']) => void
}

export const OrgStep = (props: TOrgStep) => {
  const { stepData, preSelectedOrgId, onUpdate } = props
  const [orgs] = useOrgs()
  const orgsArray = orgs ? Object.values(orgs) : []
  const hasExisting = orgsArray.length > 0

  const [showChoice, setShowChoice] = useState(
    hasExisting &&
      !preSelectedOrgId &&
      stepData.mode !== `create` &&
      stepData.mode !== `select`
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

  const onSelectOrg = useCallback(
    (org: { id: string; name: string }) => {
      onUpdate({ mode: `select`, selectedId: org.id, selectedName: org.name })
    },
    [onUpdate]
  )

  const onBackToChoice = useCallback(() => {
    setShowChoice(true)
    onUpdate({ mode: `create`, data: { name: ``, description: `` } })
  }, [onUpdate])

  if (preSelectedOrgId) {
    const org = orgsArray.find((o) => o.id === preSelectedOrgId)
    return (
      <Box>
        <Text
          variant='h6'
          gutterBottom
        >
          Organization
        </Text>
        <Text
          color='text.secondary'
          sx={{ mb: 2 }}
        >
          Setting up resources for this organization
        </Text>
        <Box
          sx={{
            p: 2,
            border: 1,
            borderColor: `primary.main`,
            borderRadius: 1,
            bgcolor: `action.selected`,
          }}
        >
          <Text
            variant='subtitle1'
            fontWeight={600}
          >
            {org?.name || preSelectedOrgId}
          </Text>
          {org?.description && (
            <Text
              variant='body2'
              color='text.secondary'
            >
              {org.description}
            </Text>
          )}
        </Box>
        {orgsArray.length > 1 && (
          <Button
            size='small'
            onClick={() => onUpdate({ mode: `select`, selectedId: ``, selectedName: `` })}
            sx={{ mt: 1 }}
          >
            Change organization
          </Button>
        )}
      </Box>
    )
  }

  if (showChoice) {
    return (
      <Box>
        <Text
          variant='h6'
          gutterBottom
        >
          Organization
        </Text>
        <Text
          color='text.secondary'
          sx={{ mb: 3 }}
        >
          Choose an existing organization or create a new one
        </Text>
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
          <ResourceChoiceCard onClick={() => onSelectMode(`create`)}>
            <Text
              variant='subtitle1'
              fontWeight={600}
            >
              Create a new organization
            </Text>
            <Text
              variant='body2'
              color='text.secondary'
            >
              Start fresh with a new organization
            </Text>
          </ResourceChoiceCard>
          <ResourceChoiceCard onClick={() => onSelectMode(`select`)}>
            <Text
              variant='subtitle1'
              fontWeight={600}
            >
              Use an existing organization
            </Text>
            <Text
              variant='body2'
              color='text.secondary'
            >
              Select from your {orgsArray.length} organization
              {orgsArray.length !== 1 ? `s` : ``}
            </Text>
          </ResourceChoiceCard>
        </Box>
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
          <Text variant='h6'>Select Organization</Text>
          {hasExisting && (
            <Button
              size='small'
              onClick={onBackToChoice}
            >
              Back
            </Button>
          )}
        </Box>
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1 }}>
          {orgsArray.map((org) => (
            <ResourceChoiceCard
              key={org.id}
              selected={stepData.selectedId === org.id}
              onClick={() => onSelectOrg({ id: org.id, name: org.name })}
            >
              <Text
                variant='subtitle1'
                fontWeight={600}
              >
                {org.name}
              </Text>
              {org.description && (
                <Text
                  variant='body2'
                  color='text.secondary'
                >
                  {org.description}
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
        <Text variant='h6'>Create Organization</Text>
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
        Name your organization to get started
      </Text>
      <TextInput
        id='org-name'
        fullWidth
        required
        label='Organization name'
        value={stepData.data?.name || ``}
        onChange={(e) =>
          onUpdate({
            mode: `create`,
            data: { name: e.target.value, description: stepData.data?.description || `` },
          })
        }
      />
      <TextInput
        id='org-description'
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
    </Box>
  )
}
