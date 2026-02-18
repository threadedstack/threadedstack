import type { TProviderStepData } from '@TAF/types'

import { useMemo } from 'react'
import { styled, alpha } from '@mui/material/styles'
import { ProviderTemplates } from '@tdsk/domain'
import { TextInput, SelectInput } from '@tdsk/components'
import {
  Box,
  Card,
  Typography,
  CardContent,
  CardActionArea,
  Collapse,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloudQueueIcon from '@mui/icons-material/CloudQueue'

const SectionHeader = styled(Box)(({ theme }) => ({
  display: `flex`,
  alignItems: `center`,
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1.5),
}))

const SectionIcon = styled(Box)(({ theme }) => ({
  width: 28,
  height: 28,
  display: `flex`,
  alignItems: `center`,
  justifyContent: `center`,
  borderRadius: theme.spacing(0.75),
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  color: theme.palette.primary.main,
}))

const ProvidersGrid = styled(Box)(({ theme }) => ({
  display: `grid`,
  gap: theme.spacing(1.5),
  gridTemplateColumns: `repeat(2, 1fr)`,
  [theme.breakpoints.up(`md`)]: {
    gridTemplateColumns: `repeat(4, 1fr)`,
  },
}))

const ProviderCard = styled(Card, {
  shouldForwardProp: (p) => p !== `selected`,
})<{ selected?: boolean }>(({ theme, selected }) => ({
  position: `relative`,
  cursor: `pointer`,
  borderRadius: theme.spacing(1.5),
  transition: `all 0.25s cubic-bezier(0.4, 0, 0.2, 1)`,
  border: `2px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
  backgroundColor: selected
    ? alpha(theme.palette.primary.main, 0.06)
    : theme.palette.background.paper,
  boxShadow: selected ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.2)}` : `none`,
  '&:hover': {
    borderColor: selected ? theme.palette.primary.main : theme.palette.primary.light,
    transform: `translateY(-2px)`,
    boxShadow: selected
      ? `0 4px 12px ${alpha(theme.palette.primary.main, 0.25)}`
      : theme.palette.mode === `dark`
        ? `0 4px 12px rgba(0,0,0,0.4)`
        : `0 4px 12px rgba(0,0,0,0.08)`,
  },
}))

const SelectedBadge = styled(Box)(({ theme }) => ({
  position: `absolute`,
  top: 6,
  right: 6,
  color: theme.palette.primary.main,
  display: `flex`,
  alignItems: `center`,
  justifyContent: `center`,
}))

const ConfigSection = styled(Box)(({ theme }) => ({
  display: `flex`,
  flexDirection: `column`,
  gap: theme.spacing(2.5),
  padding: theme.spacing(2.5),
  borderRadius: theme.spacing(1.5),
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
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
        <SectionHeader>
          <SectionIcon>
            <CloudQueueIcon sx={{ fontSize: 16 }} />
          </SectionIcon>
          <Typography
            variant='subtitle2'
            sx={{ fontWeight: 600, letterSpacing: `0.02em` }}
          >
            Choose AI Provider
          </Typography>
        </SectionHeader>
        <ProvidersGrid>
          {Object.values(ProviderTemplates).map((tmpl) => {
            const isSelected = data.providerTemp === tmpl.id
            return (
              <ProviderCard
                key={tmpl.id}
                selected={isSelected}
                elevation={0}
              >
                {isSelected && (
                  <SelectedBadge>
                    <CheckCircleIcon sx={{ fontSize: 16 }} />
                  </SelectedBadge>
                )}
                <CardActionArea
                  disabled={disabled}
                  onClick={() => onSelectProvider(tmpl.id)}
                  sx={{ borderRadius: `inherit` }}
                >
                  <CardContent
                    sx={{
                      textAlign: `center`,
                      py: 2.5,
                      px: 1.5,
                    }}
                  >
                    <Typography
                      variant='subtitle2'
                      sx={{
                        fontWeight: isSelected ? 600 : 500,
                        color: isSelected ? `primary.main` : `text.primary`,
                        transition: `color 0.2s ease`,
                      }}
                    >
                      {tmpl.name}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </ProviderCard>
            )
          })}
        </ProvidersGrid>
      </Box>

      <Collapse
        in={!!data.providerTemp}
        timeout={350}
      >
        <ConfigSection>
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
        </ConfigSection>
      </Collapse>
    </Box>
  )
}
