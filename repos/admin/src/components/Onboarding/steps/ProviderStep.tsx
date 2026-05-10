import type { TAIProviderBrand } from '@tdsk/domain'
import type { TOnboardingStepData } from '@TAF/types'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import { useState, useCallback } from 'react'
import { AIProviderTemplates } from '@tdsk/domain'
import { useProviders } from '@TAF/state/selectors'
import { Text, TextInput } from '@tdsk/components'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import {
  SkipWarning,
  ResourceChoiceCard,
} from '@TAF/components/Onboarding/OnboardingWizard.styled'

export type TProviderStep = {
  onSkip: () => void
  stepData: TOnboardingStepData['provider']
  onUpdate: (data: TOnboardingStepData['provider']) => void
}

const brands = Object.entries(AIProviderTemplates) as [
  TAIProviderBrand,
  (typeof AIProviderTemplates)[keyof typeof AIProviderTemplates],
][]

export const ProviderStep = (props: TProviderStep) => {
  const { stepData, onUpdate, onSkip } = props
  const [providers] = useProviders()
  const providersArray = providers ? Object.values(providers) : []
  const hasExisting = providersArray.length > 0

  const [showChoice, setShowChoice] = useState(
    hasExisting && stepData.mode !== `create` && stepData.mode !== `select`
  )

  const onSelectMode = useCallback(
    (mode: `create` | `select`) => {
      setShowChoice(false)
      if (mode === `create`)
        onUpdate({
          mode: `create`,
          data: {
            apiKey: ``,
            model: ``,
            providerUrl: ``,
            providerName: ``,
            providerBrand: `anthropic` as TAIProviderBrand,
          },
        })
      else onUpdate({ mode: `select`, selectedId: ``, selectedName: `` })
    },
    [onUpdate]
  )

  const onBackToChoice = useCallback(() => {
    setShowChoice(true)
    onUpdate({
      mode: `create`,
      data: {
        apiKey: ``,
        model: ``,
        providerUrl: ``,
        providerName: ``,
        providerBrand: `anthropic` as TAIProviderBrand,
      },
    })
  }, [onUpdate])

  if (showChoice) {
    return (
      <Box>
        <Text
          variant='h6'
          gutterBottom
        >
          AI Provider
        </Text>
        <Text
          color='text.secondary'
          sx={{ mb: 3 }}
        >
          Connect an AI provider or use one you've already configured
        </Text>
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
          <ResourceChoiceCard onClick={() => onSelectMode(`create`)}>
            <Text
              variant='subtitle1'
              fontWeight={600}
            >
              Add a new provider
            </Text>
            <Text
              variant='body2'
              color='text.secondary'
            >
              Configure a new AI provider with API key
            </Text>
          </ResourceChoiceCard>
          <ResourceChoiceCard onClick={() => onSelectMode(`select`)}>
            <Text
              variant='subtitle1'
              fontWeight={600}
            >
              Use an existing provider
            </Text>
            <Text
              variant='body2'
              color='text.secondary'
            >
              Select from your {providersArray.length} configured provider
              {providersArray.length !== 1 ? `s` : ``}
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
            Providers are required to use sandboxes and AI features. You can add one later
            from the Providers page.
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
          <Text variant='h6'>Select Provider</Text>
          <Button
            size='small'
            onClick={onBackToChoice}
          >
            Back
          </Button>
        </Box>
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1 }}>
          {providersArray.map((prov) => (
            <ResourceChoiceCard
              key={prov.id}
              selected={stepData.selectedId === prov.id}
              onClick={() =>
                onUpdate({ mode: `select`, selectedId: prov.id, selectedName: prov.name })
              }
            >
              <Text
                variant='subtitle1'
                fontWeight={600}
              >
                {prov.name}
              </Text>
              <Text
                variant='body2'
                color='text.secondary'
              >
                {prov.brand || prov.type}
              </Text>
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
        <Text variant='h6'>Add Provider</Text>
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
        Select your AI provider and enter your API key
      </Text>
      <Text
        variant='subtitle2'
        sx={{ mb: 1 }}
      >
        Provider
      </Text>
      <Box sx={{ display: `flex`, flexWrap: `wrap`, gap: 1, mb: 3 }}>
        {brands.map(([brand, template]) => (
          <ResourceChoiceCard
            key={brand}
            selected={stepData.data?.providerBrand === brand}
            onClick={() =>
              onUpdate({
                mode: `create`,
                data: {
                  ...(stepData.data || {
                    apiKey: ``,
                    model: ``,
                    providerUrl: ``,
                    providerName: ``,
                  }),
                  providerBrand: brand,
                  providerName: template?.name || brand,
                  providerUrl: template?.baseUrl || ``,
                },
              })
            }
            sx={{ flex: `0 0 auto`, minWidth: 100, textAlign: `center`, py: 1.5 }}
          >
            <Text
              variant='body2'
              fontWeight={600}
            >
              {template?.name || brand}
            </Text>
          </ResourceChoiceCard>
        ))}
      </Box>
      <TextInput
        id='provider-api-key'
        fullWidth
        required
        type='password'
        label='API Key'
        placeholder={
          AIProviderTemplates[
            stepData.data?.providerBrand as keyof typeof AIProviderTemplates
          ]?.apiKeyPlaceholder || `Enter API key`
        }
        value={stepData.data?.apiKey || ``}
        onChange={(e) =>
          onUpdate({
            mode: `create`,
            data: { ...stepData.data!, apiKey: e.target.value },
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
            Providers are required to use sandboxes and AI features. You can add one later
            from the Providers page.
          </Text>
        </SkipWarning>
      )}
    </Box>
  )
}
