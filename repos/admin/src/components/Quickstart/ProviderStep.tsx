import type { TProviderStepData } from '@TAF/types'
import type { TLLMProviderBrand, TProviderModel } from '@tdsk/domain'

import { useMemo, useState, useCallback } from 'react'
import { ELLMProviderBrand, ProviderTemplates } from '@tdsk/domain'
import { providersApi } from '@TAF/services/providersApi'
import { styled, alpha } from '@mui/material/styles'
import { TextInput, SelectInput } from '@tdsk/components'
import CloudQueueIcon from '@mui/icons-material/CloudQueue'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import PsychologyIcon from '@mui/icons-material/Psychology'
import TravelExploreIcon from '@mui/icons-material/TravelExplore'
import BoltIcon from '@mui/icons-material/Bolt'
import HubIcon from '@mui/icons-material/Hub'
import TerminalIcon from '@mui/icons-material/Terminal'
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest'
import {
  Box,
  Card,
  Collapse,
  Typography,
  CardContent,
  CardActionArea,
  CircularProgress,
} from '@mui/material'

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
  color: theme.palette.primary.main,
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
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

const dynamicBrands = new Set<string>([
  ELLMProviderBrand.openai,
  ELLMProviderBrand.google,
  ELLMProviderBrand.ollama,
  ELLMProviderBrand.openrouter,
])

// Brands that need the user's API key to fetch models
const keyRequiredBrands = new Set<string>([
  ELLMProviderBrand.openai,
  ELLMProviderBrand.google,
])

const ProviderIcons: Record<string, typeof AutoAwesomeIcon> = {
  [ELLMProviderBrand.anthropic]: AutoAwesomeIcon,
  [ELLMProviderBrand.openai]: PsychologyIcon,
  [ELLMProviderBrand.google]: TravelExploreIcon,
  [ELLMProviderBrand.zai]: BoltIcon,
  [ELLMProviderBrand.openrouter]: HubIcon,
  [ELLMProviderBrand.ollama]: TerminalIcon,
  [ELLMProviderBrand.custom]: SettingsSuggestIcon,
}

export const ProviderStep = (props: TProviderStep) => {
  const { data, onChange, disabled } = props
  const template = ProviderTemplates[data.providerBrand]

  const [dynamicModels, setDynamicModels] = useState<TProviderModel[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)

  const modelOptions = useMemo(() => {
    const models = dynamicModels.length > 0 ? dynamicModels : template?.models || []
    if (!models.length) return []
    return models.map((m) => ({
      value: m.id,
      label: m.name,
    }))
  }, [template, dynamicModels])

  const fetchDynamicModels = useCallback(
    async (brand: string, opts?: { baseUrl?: string; providerKey?: string }) => {
      setFetchingModels(true)
      try {
        const resp = await providersApi.fetchModels(brand, opts)
        setDynamicModels(resp.data || [])
      } catch {
        setDynamicModels([])
      }
      setFetchingModels(false)
    },
    []
  )

  const onSelectProvider = (id: TLLMProviderBrand) => {
    const tmpl = ProviderTemplates[id]
    setDynamicModels([])
    onChange({
      providerUrl: ``,
      providerName: ``,
      providerBrand: id,
      apiKey: data.apiKey,
      model: tmpl?.defaultModel || ``,
    })
    // Auto-fetch for brands that don't need a key (openrouter, ollama)
    // Key-required brands (openai, google) fetch after API key is entered
    if (dynamicBrands.has(id) && !keyRequiredBrands.has(id)) fetchDynamicModels(id)
  }

  const onApiKeyBlur = () => {
    if (data.apiKey && keyRequiredBrands.has(data.providerBrand))
      fetchDynamicModels(data.providerBrand, { providerKey: data.apiKey })
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
                          fontSize: 28,
                          mb: 0.5,
                          color: isSelected ? `primary.main` : `text.secondary`,
                          transition: `color 0.2s ease`,
                        }}
                      />
                    )}
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
        in={!!data.providerBrand}
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
            sx={{ bgcolor: `background.paper` }}
            placeholder={template?.apiKeyPlaceholder || `Enter your API key...`}
            onChange={(e) => onChange({ apiKey: e.target.value })}
            onBlur={onApiKeyBlur}
          />

          {data.providerBrand === ELLMProviderBrand.ollama && (
            <TextInput
              fullWidth
              label='Ollama Base URL'
              value={data.providerUrl}
              disabled={disabled}
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
                label='Provider Name'
                value={data.providerName}
                disabled={disabled}
                id='quickstart-custom-name'
                sx={{ bgcolor: `background.paper` }}
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
          ) : fetchingModels ? (
            <Box sx={{ display: `flex`, alignItems: `center`, gap: 1.5, py: 1 }}>
              <CircularProgress size={18} />
              <Typography
                variant='body2'
                color='text.secondary'
              >
                Loading models...
              </Typography>
            </Box>
          ) : modelOptions.length > 0 ? (
            <SelectInput
              fullWidth
              label='Model'
              value={data.model}
              disabled={disabled}
              id='quickstart-model'
              items={modelOptions}
              sx={{ bgcolor: `background.paper` }}
              onChange={(e) => onChange({ model: e.target.value as string })}
            />
          ) : dynamicBrands.has(data.providerBrand) ? (
            <TextInput
              required
              fullWidth
              label='Model'
              value={data.model}
              disabled={disabled}
              id='quickstart-dynamic-model'
              sx={{ bgcolor: `background.paper` }}
              placeholder='e.g., llama3.2'
              onChange={(e) => onChange({ model: e.target.value })}
            />
          ) : null}
        </ConfigSection>
      </Collapse>
    </Box>
  )
}
