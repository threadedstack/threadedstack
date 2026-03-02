import type { TAiProviderOption } from '@TAF/types/agent.types'

import { useState } from 'react'
import { ModelSelect } from './ModelSelect'
import { InputStateHandler } from '@tdsk/components'
import {
  Box,
  Chip,
  List,
  ListItem,
  TextField,
  IconButton,
  Typography,
  Autocomplete,
} from '@mui/material'
import {
  Add as AddIcon,
  Close as RemoveIcon,
  ArrowUpward as UpIcon,
  ArrowDownward as DownIcon,
} from '@mui/icons-material'

export type TProviderPriorityListProps = {
  loading: boolean
  providerIds: string[]
  aiProviders: TAiProviderOption[]
  providerModels: Record<string, string>
  onChange: (providerIds: string[]) => void
  onModelChange: (models: Record<string, string>) => void
}

export const ProviderPriorityList = (props: TProviderPriorityListProps) => {
  const { loading, onChange, aiProviders, providerIds, onModelChange, providerModels } =
    props

  const [addingProvider, setAddingProvider] = useState(false)

  const availableProviders = aiProviders.filter((p) => !providerIds.includes(p.id))
  const getProviderName = (id: string) => aiProviders.find((p) => p.id === id)?.name || id
  const getProviderBrand = (id: string) =>
    aiProviders.find((p) => p.id === id)?.brand || ''

  const onMoveUp = (index: number) => {
    if (index === 0) return
    const updated = [...providerIds]
    ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
    onChange(updated)
  }

  const onMoveDown = (index: number) => {
    if (index === providerIds.length - 1) return
    const updated = [...providerIds]
    ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
    onChange(updated)
  }

  const onRemove = (index: number) => {
    const removedId = providerIds[index]
    onChange(providerIds.filter((_, i) => i !== index))
    // Clean up model for removed provider
    if (removedId && providerModels[removedId]) {
      const updated = { ...providerModels }
      delete updated[removedId]
      onModelChange(updated)
    }
  }

  const onAdd = (providerId: string | null) => {
    if (!providerId) return
    onChange([...providerIds, providerId])
    setAddingProvider(false)
  }

  const onProviderModelChange = (providerId: string, model: string) => {
    onModelChange({ ...providerModels, [providerId]: model })
  }

  return (
    <InputStateHandler
      id='agent-providers'
      disabled={loading}
      label='AI Providers'
      description={
        loading
          ? 'Loading providers...'
          : aiProviders.length === 0
            ? 'No AI providers available. Create a provider first.'
            : 'Order determines priority. First provider is primary.'
      }
    >
      <Box>
        {providerIds.length > 0 && (
          <List
            dense
            disablePadding
          >
            {providerIds.map((id, index) => (
              <ListItem
                key={id}
                sx={{
                  pl: 1,
                  pr: 1,
                  borderRadius: 1,
                  mb: 0.5,
                  bgcolor: 'action.hover',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant='body2'>
                        {index + 1}. {getProviderName(id)}
                      </Typography>
                      {index === 0 && (
                        <Chip
                          label='Primary'
                          size='small'
                          color='primary'
                          variant='outlined'
                        />
                      )}
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                    <IconButton
                      size='small'
                      disabled={loading || index === 0}
                      onClick={() => onMoveUp(index)}
                    >
                      <UpIcon fontSize='small' />
                    </IconButton>
                    <IconButton
                      size='small'
                      disabled={loading || index === providerIds.length - 1}
                      onClick={() => onMoveDown(index)}
                    >
                      <DownIcon fontSize='small' />
                    </IconButton>
                    <IconButton
                      size='small'
                      disabled={loading}
                      onClick={() => onRemove(index)}
                    >
                      <RemoveIcon fontSize='small' />
                    </IconButton>
                  </Box>
                </Box>
                <Box sx={{ mt: 1, mb: 0.5 }}>
                  <ModelSelect
                    id={id}
                    size='small'
                    disabled={loading}
                    brand={getProviderBrand(id)}
                    model={providerModels[id] || ''}
                    onChange={(model) => onProviderModelChange(id, model)}
                  />
                </Box>
              </ListItem>
            ))}
          </List>
        )}

        {availableProviders.length > 0 && !addingProvider && (
          <Box sx={{ mt: 1 }}>
            <IconButton
              size='small'
              disabled={loading}
              onClick={() => setAddingProvider(true)}
              sx={{
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 1,
                px: 1.5,
              }}
            >
              <AddIcon
                fontSize='small'
                sx={{ mr: 0.5 }}
              />
              <Typography variant='caption'>Add Provider</Typography>
            </IconButton>
          </Box>
        )}

        {addingProvider && (
          <Box sx={{ mt: 1 }}>
            <Autocomplete
              autoFocus
              openOnFocus
              size='small'
              options={availableProviders.map((p) => p.id)}
              getOptionLabel={(id) => getProviderName(id)}
              onChange={(_, value) => onAdd(value)}
              onClose={() => setAddingProvider(false)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder='Select provider...'
                  autoFocus
                />
              )}
            />
          </Box>
        )}
      </Box>
    </InputStateHandler>
  )
}
