import type { TProviderLinkItem } from '@TAF/types'

import { useState } from 'react'
import { SelectInput } from '@tdsk/components'
import { ModelSelect } from '@TAF/components/Agents/ModelSelect'
import {
  Box,
  Chip,
  List,
  ListItem,
  IconButton,
  Typography,
  CircularProgress,
} from '@mui/material'
import {
  Add as AddIcon,
  Close as RemoveIcon,
  ArrowUpward as UpIcon,
  ArrowDownward as DownIcon,
} from '@mui/icons-material'

export type TProviderLinkListProps = {
  loading?: boolean
  linking?: boolean
  addLabel?: string
  disabled?: boolean
  reorderable?: boolean
  createLabel?: string
  onCreateNew?: () => void
  emptyMessage?: string | null
  onRemove: (id: string) => void
  providers: TProviderLinkItem[]
  availableProviders: TProviderLinkItem[]
  onAdd: (provider: TProviderLinkItem) => void
  onModelChange?: (id: string, model: string) => void
  onReorder?: (providers: TProviderLinkItem[]) => void
}

export const ProviderLinkList = (props: TProviderLinkListProps) => {
  const {
    onAdd,
    loading,
    linking,
    disabled,
    onRemove,
    providers,
    onReorder,
    reorderable,
    onCreateNew,
    emptyMessage,
    onModelChange,
    availableProviders,
    addLabel = `Add Provider`,
    createLabel = `Create New`,
  } = props

  const [addingProvider, setAddingProvider] = useState(false)
  const isDisabled = disabled || loading

  const onMoveUp = (index: number) => {
    if (!onReorder || index === 0) return
    const updated = [...providers]
    ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
    onReorder(updated)
  }

  const onMoveDown = (index: number) => {
    if (!onReorder || index === providers.length - 1) return
    const updated = [...providers]
    ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
    onReorder(updated)
  }

  return (
    <Box>
      {emptyMessage && providers.length === 0 && (
        <Typography
          variant='body2'
          color='text.secondary'
          sx={{ mb: 1 }}
        >
          {emptyMessage}
        </Typography>
      )}

      {providers.length > 0 && (
        <List
          dense
          disablePadding
        >
          {providers.map((provider, index) => (
            <ListItem
              key={provider.id}
              sx={{
                pl: 1,
                pr: 1,
                borderRadius: 1,
                mb: 0.5,
                alignItems: 'stretch',
                bgcolor: 'action.hover',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant='body2'>
                      {reorderable ? `${index + 1}. ` : ``}
                      {provider.name}
                    </Typography>

                    {reorderable && index === 0 && (
                      <Chip
                        label='Primary'
                        size='small'
                        color='primary'
                        variant='outlined'
                      />
                    )}
                    {!reorderable && (
                      <Chip
                        size='small'
                        variant='outlined'
                        label={provider.brand}
                      />
                    )}
                    {!onModelChange && provider.model && (
                      <Chip
                        size='small'
                        color='info'
                        variant='outlined'
                        label={provider.model}
                      />
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                  {reorderable && onReorder && (
                    <>
                      <IconButton
                        size='small'
                        disabled={isDisabled || index === 0}
                        onClick={() => onMoveUp(index)}
                      >
                        <UpIcon fontSize='small' />
                      </IconButton>
                      <IconButton
                        size='small'
                        disabled={isDisabled || index === providers.length - 1}
                        onClick={() => onMoveDown(index)}
                      >
                        <DownIcon fontSize='small' />
                      </IconButton>
                    </>
                  )}
                  <IconButton
                    size='small'
                    disabled={isDisabled}
                    onClick={() => onRemove(provider.id)}
                  >
                    <RemoveIcon fontSize='small' />
                  </IconButton>
                </Box>
              </Box>
              {onModelChange && (
                <Box sx={{ mt: 1, mb: 0.5 }}>
                  <ModelSelect
                    size='small'
                    id={provider.id}
                    disabled={isDisabled}
                    brand={provider.brand}
                    model={provider.model || ''}
                    onChange={(model) => onModelChange(provider.id, model)}
                  />
                </Box>
              )}
            </ListItem>
          ))}
        </List>
      )}

      {reorderable && availableProviders.length > 0 && !addingProvider && (
        <Box sx={{ mt: 1 }}>
          <IconButton
            size='small'
            disabled={isDisabled}
            onClick={() => setAddingProvider(true)}
            sx={{
              px: 1.5,
              borderRadius: 1,
              border: '1px dashed',
              borderColor: 'divider',
            }}
          >
            <AddIcon
              fontSize='small'
              sx={{ mr: 0.5 }}
            />
            <Typography variant='caption'>{addLabel}</Typography>
          </IconButton>
        </Box>
      )}

      {reorderable && addingProvider && (
        <Box sx={{ mt: 1 }}>
          <SelectInput
            value=''
            id='add-provider-reorderable'
            placeholder='Select provider...'
            items={availableProviders.map((p) => ({ value: p.id, label: p.name }))}
            onChange={(e) => {
              const p = availableProviders.find((x) => x.id === e.target.value)
              if (p) onAdd(p)
              setAddingProvider(false)
            }}
          />
        </Box>
      )}

      {!reorderable && availableProviders.length > 0 && (
        <Box sx={{ position: 'relative' }}>
          <SelectInput
            value=''
            id='add-provider'
            label={addLabel}
            placeholder='Search providers...'
            disabled={isDisabled || linking}
            items={availableProviders.map((p) => ({
              value: p.id,
              label: `${p.name || p.id} (${p.brand})`,
            }))}
            onChange={(e) => {
              const p = availableProviders.find((x) => x.id === e.target.value)
              if (p) onAdd(p)
            }}
          />
          {linking && (
            <CircularProgress
              size={16}
              color='inherit'
              sx={{ position: 'absolute', right: 40, top: '50%', mt: -1 }}
            />
          )}
        </Box>
      )}

      {!reorderable && onCreateNew && (
        <Box sx={{ mt: availableProviders.length > 0 || providers.length > 0 ? 1 : 0 }}>
          <IconButton
            size='small'
            disabled={isDisabled}
            onClick={onCreateNew}
            sx={{
              px: 1.5,
              borderRadius: 1,
              border: '1px dashed',
              borderColor: 'divider',
            }}
          >
            <AddIcon
              fontSize='small'
              sx={{ mr: 0.5 }}
            />
            <Typography variant='caption'>{createLabel}</Typography>
          </IconButton>
        </Box>
      )}
    </Box>
  )
}
