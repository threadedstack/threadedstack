import type { TProviderModel, TAIProviderBrand } from '@tdsk/domain'

import { EAIProviderBrand } from '@tdsk/domain'
import { DynamicBrands } from '@TAF/constants/providers'
import { TextInput, SelectInput } from '@tdsk/components'
import { fetchProviderModels } from '@TAF/actions/providers'
import { useMemo, useState, useCallback } from 'react'
import { Alert, Box, Typography, CircularProgress } from '@mui/material'

export type TModelSelectProps = {
  id?: string
  orgId: string
  model: string
  baseUrl?: string
  disabled?: boolean
  size?: 'small' | 'medium'
  brand: TAIProviderBrand | string
  onChange: (model: string) => void
}

export const ModelSelect = (props: TModelSelectProps) => {
  const {
    brand,
    model,
    orgId,
    baseUrl,
    disabled,
    onChange,
    id: idProp,
    size = `small`,
  } = props

  const idSuffix = idProp || brand

  const [models, setModels] = useState<TProviderModel[] | null>(null)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const modelOptions = useMemo(() => {
    if (!models?.length) return []
    return models.map((m) => ({ value: m.id, label: m.name }))
  }, [models])

  const loadModels = useCallback(async () => {
    if (!brand || !orgId) return
    if (!DynamicBrands.has(brand as string)) {
      setModels([])
      return
    }
    if (brand === EAIProviderBrand.ollama && !baseUrl) {
      setModels([])
      return
    }
    setFetching(true)
    setError(null)
    const resp = await fetchProviderModels({
      orgId,
      brand,
      ...(baseUrl && { baseUrl }),
    })
    setFetching(false)
    if (resp.error) {
      setError(resp.error.message || `Could not load models for ${brand}`)
      setModels([])
      return
    }
    setModels(resp.data || [])
  }, [brand, orgId, baseUrl])

  const handleOpen = useCallback(() => {
    if (models === null && !fetching) void loadModels()
  }, [models, fetching, loadModels])

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
        onFocus={handleOpen}
        placeholder='e.g., gpt-4o, claude-sonnet-4-20250514'
      />
      {error && (
        <Alert
          severity='warning'
          sx={{ fontSize: '0.8rem', py: 0, '& .MuiAlert-message': { py: 0.5 } }}
        >
          {error}. Enter a model ID manually.
        </Alert>
      )}
      {brand === EAIProviderBrand.ollama && !baseUrl && !error && (
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
