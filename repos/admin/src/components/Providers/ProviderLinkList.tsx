import type { TProviderLinkItem } from '@TAF/types'

import { useState } from 'react'
import { ModelSelect } from '@TAF/components/Agents/ModelSelect'
import {
  Box,
  Chip,
  List,
  ListItem,
  TextField,
  IconButton,
  Typography,
  Autocomplete,
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
    emptyMessage,
    onModelChange,
    availableProviders,
    addLabel = `Add Provider`,
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
                bgcolor: 'action.hover',
                flexDirection: 'column',
                alignItems: 'stretch',
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
                        variant='outlined'
                        color='info'
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
                    id={provider.id}
                    size='small'
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
            <Typography variant='caption'>{addLabel}</Typography>
          </IconButton>
        </Box>
      )}

      {reorderable && addingProvider && (
        <Box sx={{ mt: 1 }}>
          <Autocomplete
            autoFocus
            openOnFocus
            size='small'
            options={availableProviders}
            getOptionLabel={(opt) => opt.name}
            onChange={(_, value) => {
              if (value) onAdd(value)
              setAddingProvider(false)
            }}
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

      {!reorderable && availableProviders.length > 0 && (
        <Autocomplete
          size='small'
          options={availableProviders}
          disabled={isDisabled || linking}
          getOptionLabel={(opt) => `${opt.name || opt.id} (${opt.brand})`}
          onChange={(_evt, value) => {
            if (value) onAdd(value)
          }}
          value={null}
          renderInput={(params) => (
            <TextField
              {...params}
              label={addLabel}
              placeholder='Search providers...'
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {linking && (
                      <CircularProgress
                        color='inherit'
                        size={16}
                      />
                    )}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          renderOption={(optProps, option) => (
            <li
              {...optProps}
              key={option.id}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant='body2'>{option.name || option.id}</Typography>
                <Chip
                  size='small'
                  variant='outlined'
                  label={option.brand}
                />
              </Box>
            </li>
          )}
        />
      )}
    </Box>
  )
}
