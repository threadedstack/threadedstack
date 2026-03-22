import type { TProviderStepData } from '@TAF/types'
import type { TLLMProviderBrand } from '@tdsk/domain'

import { TextInput } from '@tdsk/components'
import { styled, alpha } from '@mui/material/styles'
import { ProviderIcons } from '@TAF/constants/providers'
import CloudQueueIcon from '@mui/icons-material/CloudQueue'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { ModelSelect } from '@TAF/components/Agents/ModelSelect'
import { ELLMProviderBrand, ProviderTemplates } from '@tdsk/domain'
import {
  SectionHeader,
  SectionIcon,
  FormSection,
} from '@TAF/components/Quickstart/Quickstart.styled'

import {
  Box,
  Card,
  Collapse,
  Typography,
  CardContent,
  CardActionArea,
} from '@mui/material'

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
  top: 6,
  right: 6,
  display: `flex`,
  alignItems: `center`,
  position: `absolute`,
  justifyContent: `center`,
  color: theme.palette.primary.main,
}))

export type TProviderStep = {
  disabled?: boolean
  data: TProviderStepData
  onChange: (updates: Partial<TProviderStepData>) => void
}

export const ProviderStep = (props: TProviderStep) => {
  const { data, onChange, disabled } = props
  const template = ProviderTemplates[data.providerBrand]

  const onSelectProvider = (id: TLLMProviderBrand) => {
    onChange({
      model: ``,
      providerUrl: ``,
      providerName: ``,
      providerBrand: id,
      apiKey: data.apiKey,
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
            sx={{ fontWeight: 600 }}
          >
            Choose AI Provider
          </Typography>
        </SectionHeader>
        <ProvidersGrid>
          {Object.values(ProviderTemplates).map((tmpl) => {
            const isSelected = data.providerBrand === tmpl.id
            const Icon = ProviderIcons[tmpl.id]
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
                    {Icon && (
                      <Icon
                        sx={{
                          mb: 0.5,
                          fontSize: 28,
                          transition: `color 0.2s ease`,
                          color: isSelected ? `primary.main` : `text.secondary`,
                        }}
                      />
                    )}
                    <Typography
                      variant='subtitle2'
                      sx={{
                        transition: `color 0.2s ease`,
                        fontWeight: isSelected ? 600 : 500,
                        color: isSelected ? `primary.main` : `text.primary`,
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
        in={!!data.providerBrand}
        timeout={350}
      >
        <FormSection>
          <TextInput
            required
            fullWidth
            type='password'
            label='API Key'
            value={data.apiKey}
            disabled={disabled}
            id='quickstart-api-key'
            sx={{ bgcolor: `background.paper` }}
            placeholder={template?.apiKeyPlaceholder || `Enter your API key...`}
            onChange={(e) => onChange({ apiKey: e.target.value })}
          />

          {data.providerBrand === ELLMProviderBrand.ollama && (
            <TextInput
              fullWidth
              disabled={disabled}
              label='Ollama Base URL'
              value={data.providerUrl}
              id='quickstart-ollama-url'
              sx={{ bgcolor: `background.paper` }}
              placeholder='http://localhost:11434/v1'
              onChange={(e) => onChange({ providerUrl: e.target.value })}
            />
          )}

          {data.providerBrand === ELLMProviderBrand.custom ? (
            <>
              <TextInput
                required
                fullWidth
                disabled={disabled}
                label='Provider Name'
                value={data.providerName}
                id='quickstart-custom-name'
                sx={{ bgcolor: `background.paper` }}
                placeholder='e.g., My LLM Provider'
                onChange={(e) => onChange({ providerName: e.target.value })}
              />
              <TextInput
                required
                fullWidth
                label='Base URL'
                disabled={disabled}
                value={data.providerUrl}
                id='quickstart-custom-url'
                sx={{ bgcolor: `background.paper` }}
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
                sx={{ bgcolor: `background.paper` }}
                placeholder='e.g., llama-3-70b'
                onChange={(e) => onChange({ model: e.target.value })}
              />
            </>
          ) : (
            <Box sx={{ bgcolor: `background.paper`, borderRadius: 1 }}>
              <ModelSelect
                size='medium'
                model={data.model}
                disabled={disabled}
                apiKey={data.apiKey}
                brand={data.providerBrand}
                baseUrl={data.providerUrl}
                onChange={(model) => onChange({ model })}
              />
            </Box>
          )}
        </FormSection>
      </Collapse>
    </Box>
  )
}
