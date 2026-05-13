import type { TProviderModel, TAIProviderBrand } from '@tdsk/domain'

import { EAIProviderBrand } from '@tdsk/domain'
import { DynamicBrands } from '@TAF/constants/providers'
import { TextInput, SelectInput } from '@tdsk/components'
import { fetchProviderModels } from '@TAF/actions/providers'
import { useMemo, useState, useEffect, useCallback } from 'react'
import { Alert, Box, Typography, CircularProgress } from '@mui/material'

export type TModelSelectProps = {
  id?: string
  model: string
  baseUrl?: string
  apiKey?: string
  disabled?: boolean
  size?: 'small' | 'medium'
  brand: TAIProviderBrand | string
  onChange: (model: string) => void
}

export const ModelSelect = (props: TModelSelectProps) => {
  const {
    brand,
    model,
    apiKey,
    baseUrl,
    disabled,
    onChange,
    id: idProp,
    size = `small`,
  } = props

  const idSuffix = idProp || brand

  const [models, setModels] = useState<TProviderModel[]>([])
  const [fetching, setFetching] = useState(false)

  const modelOptions = useMemo(() => {
    if (!models.length) return []
    return models.map((m) => ({
      value: m.id,
      label: m.name,
    }))
  }, [models])

  const fetchModels = useCallback(
    async (providerBrand: string) => {
      if (!DynamicBrands.has(providerBrand)) {
        setModels([])
        return
      }

      if (providerBrand === EAIProviderBrand.ollama && !baseUrl) {
        setModels([])
        return
      }
      setFetching(true)
      try {
        const resp = await fetchProviderModels({
          brand: providerBrand,
          ...(baseUrl && { baseUrl }),
          ...(apiKey && { providerKey: apiKey }),
        })
        setModels(resp.data || [])
      } catch (err) {
        console.warn(`[ModelSelect] Failed to fetch models for ${providerBrand}:`, err)
        setModels([])
      }
      setFetching(false)
    },
    [baseUrl, apiKey]
  )

  useEffect(() => {
    brand && fetchModels(brand)
  }, [brand, fetchModels])

  if (fetching) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
        <CircularProgress size={14} />
        <Typography
          variant='caption'
          color='text.secondary'
        >
          Loading models...
        </Typography>
      </Box>
    )
  }

  if (modelOptions.length > 0) {
    return (
      <SelectInput
        fullWidth
        label='Model'
        value={model}
        size={size}
        disabled={disabled}
        id={`model-select-${idSuffix}`}
        items={modelOptions}
        onChange={(e) => onChange(e.target.value as string)}
      />
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <TextInput
        fullWidth
        size={size}
        label='Model'
        value={model}
        disabled={disabled}
        id={`model-input-${idSuffix}`}
        onChange={(e) => onChange(e.target.value)}
        placeholder='e.g., gpt-4o, claude-sonnet-4-20250514'
      />
      {brand === EAIProviderBrand.ollama && !baseUrl && (
        <Alert
          severity='info'
          sx={{ fontSize: '0.8rem', py: 0, '& .MuiAlert-message': { py: 0.5 } }}
        >
          Set a Base URL on the Ollama provider to enable model selection
        </Alert>
      )}
    </Box>
  )
}
