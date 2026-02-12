import type { TProviderStepData } from '@TAF/types'

import { useMemo } from 'react'
import { styled } from '@mui/material/styles'
import { ProviderTemplates } from '@tdsk/domain'
import { TextInput, SelectInput } from '@tdsk/components'
import { Box, Card, Typography, CardContent, CardActionArea } from '@mui/material'

const ProvidersGrid = styled(Box)(({ theme }) => ({
  display: `grid`,
  gap: theme.spacing(2),
  gridTemplateColumns: `repeat(auto-fill, minmax(160px, 1fr))`,
}))

const ProviderCard = styled(Card, {
  shouldForwardProp: (p) => p !== `selected`,
})<{ selected?: boolean }>(({ theme, selected }) => ({
  transition: `border-color 0.2s, background-color 0.2s`,
  backgroundColor: selected ? theme.palette.action.selected : undefined,
  border: `2px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
}))

export type TProviderStep = {
  disabled?: boolean
  data: TProviderStepData
  onChange: (updates: Partial<TProviderStepData>) => void
}

export const ProviderStep = (props: TProviderStep) => {
  const { data, onChange, disabled } = props
  const template = ProviderTemplates[data.providerTemp]

  const modelOptions = useMemo(() => {
    if (!template?.models?.length) return []
    return template.models.map((m) => ({
      value: m.id,
      label: m.name,
    }))
  }, [template])

  const onSelectProvider = (id: string) => {
    const tmpl = ProviderTemplates[id]
    onChange({
      providerUrl: ``,
      providerTemp: id,
      providerName: ``,
      apiKey: data.apiKey,
      model: tmpl?.defaultModel || ``,
    })
  }

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 3 }}>
      <Box>
        <Typography
          variant='subtitle2'
          sx={{ mb: 1 }}
        >
          Choose AI Provider
        </Typography>
        <ProvidersGrid>
          {Object.values(ProviderTemplates).map((tmpl) => (
            <ProviderCard
              key={tmpl.id}
              selected={data.providerTemp === tmpl.id}
              elevation={data.providerTemp === tmpl.id ? 4 : 1}
            >
              <CardActionArea
                disabled={disabled}
                onClick={() => onSelectProvider(tmpl.id)}
              >
                <CardContent sx={{ textAlign: `center`, py: 2 }}>
                  <Typography variant='subtitle1'>{tmpl.name}</Typography>
                </CardContent>
              </CardActionArea>
            </ProviderCard>
          ))}
        </ProvidersGrid>
      </Box>

      {data.providerTemp && (
        <>
          <TextInput
            required
            fullWidth
            type='password'
            label='API Key'
            value={data.apiKey}
            disabled={disabled}
            id='quickstart-api-key'
            placeholder={template?.apiKeyPlaceholder || `Enter your API key...`}
            onChange={(e) => onChange({ apiKey: e.target.value })}
          />

          {data.providerTemp === `custom` ? (
            <>
              <TextInput
                required
                fullWidth
                label='Provider Name'
                value={data.providerName}
                disabled={disabled}
                id='quickstart-custom-name'
                placeholder='e.g., My LLM Provider'
                onChange={(e) => onChange({ providerName: e.target.value })}
              />
              <TextInput
                required
                fullWidth
                label='Base URL'
                value={data.providerUrl}
                disabled={disabled}
                id='quickstart-custom-url'
                placeholder='e.g., https://api.example.com/v1'
                onChange={(e) => onChange({ providerUrl: e.target.value })}
              />
              <TextInput
                required
                fullWidth
                label='Model'
                value={data.model}
                disabled={disabled}
                id='quickstart-custom-model'
                placeholder='e.g., llama-3-70b'
                onChange={(e) => onChange({ model: e.target.value })}
              />
            </>
          ) : modelOptions.length > 0 ? (
            <SelectInput
              fullWidth
              label='Model'
              value={data.model}
              disabled={disabled}
              id='quickstart-model'
              items={modelOptions}
              onChange={(e) => onChange({ model: e.target.value as string })}
            />
          ) : null}
        </>
      )}
    </Box>
  )
}
