import type { Secret } from '@tdsk/domain'

import { useState } from 'react'
import { TextInput } from '@tdsk/components'
import { Add as AddIcon, Key as KeyIcon, Delete as DeleteIcon } from '@mui/icons-material'
import {
  Box,
  Chip,
  Paper,
  Tooltip,
  TextField,
  IconButton,
  Typography,
  Autocomplete,
} from '@mui/material'

export type TKeyValuePair = {
  id: string
  key: string
  value: string
}

export type TKeyValueEditorProps = {
  label?: string
  pairs: TKeyValuePair[]
  disabled?: boolean
  placeholder?: string
  secrets?: Secret[]
  keyPlaceholder?: string
  valuePlaceholder?: string
  enableSecretReferences?: boolean
  onChange: (pairs: TKeyValuePair[]) => void
}

/**
 * KeyValueEditor - Editable key-value pair list with secret reference support
 *
 * Features:
 * - Add/remove key-value pairs
 * - Secret reference syntax: {{secret-name}}
 * - Autocomplete for secret names when typing {{
 * - Visual indicators for secret references
 */
export const KeyValueEditor = (props: TKeyValueEditorProps) => {
  const {
    label = `Key-Value Pairs`,
    pairs,
    disabled,
    onChange,
    secrets = [],
    keyPlaceholder = `Key`,
    enableSecretReferences = true,
    valuePlaceholder = `Value or {{secret-name}}`,
  } = props

  const [activeAutocomplete, setActiveAutocomplete] = useState<string | null>(null)

  const addPair = () => {
    const newPair: TKeyValuePair = {
      id: `kv-${Date.now()}`,
      key: ``,
      value: ``,
    }
    onChange([...pairs, newPair])
  }

  const removePair = (id: string) => {
    onChange(pairs.filter((p) => p.id !== id))
  }

  const updateKey = (id: string, key: string) => {
    onChange(pairs.map((p) => (p.id === id ? { ...p, key } : p)))
  }

  const updateValue = (id: string, value: string) => {
    onChange(pairs.map((p) => (p.id === id ? { ...p, value } : p)))
  }

  // Extract secret name from {{secret-name}} pattern
  const extractSecretName = (value: string): string | null => {
    const match = value.match(/\{\{([^}]+)\}\}/)
    return match ? match[1] : null
  }

  // Check if value contains secret reference
  const hasSecretReference = (value: string): boolean => {
    return /\{\{[^}]+\}\}/.test(value)
  }

  // Get autocomplete options when typing {{
  const getAutocompleteOptions = (value: string): string[] => {
    if (!enableSecretReferences || !value.includes('{{')) return []

    // Extract the partial secret name after {{
    const match = value.match(/\{\{([^}]*)$/)
    if (!match) return []

    const partialName = match[1].toLowerCase()
    return secrets
      .filter((s) => (s.name || s.hashKey || ``).toLowerCase().includes(partialName))
      .map((s) => s.name || s.hashKey || ``)
  }

  const handleValueChange = (id: string, newValue: string, oldValue: string) => {
    // Check if user just typed {{
    if (newValue.includes(`{{`) && !oldValue.includes(`{{`)) {
      setActiveAutocomplete(id)
    } else if (!newValue.includes(`{{`)) {
      setActiveAutocomplete(null)
    }

    updateValue(id, newValue)
  }

  const handleSecretSelect = (id: string, currentValue: string, secretName: string) => {
    // Replace the partial secret reference with complete one
    const beforeBraces = currentValue.substring(0, currentValue.lastIndexOf(`{{`))
    const newValue = `${beforeBraces}{{${secretName}}}`
    updateValue(id, newValue)
    setActiveAutocomplete(null)
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1,
        }}
      >
        <Typography
          variant='subtitle2'
          sx={{ fontWeight: 600 }}
        >
          {label}
        </Typography>
        <Tooltip title='Add new key-value pair'>
          <IconButton
            size='small'
            onClick={addPair}
            disabled={disabled}
            sx={{ color: 'primary.main' }}
          >
            <AddIcon fontSize='small' />
          </IconButton>
        </Tooltip>
      </Box>

      {pairs.length === 0 ? (
        <Paper
          variant='outlined'
          sx={{
            p: 3,
            textAlign: 'center',
            bgcolor: 'action.hover',
          }}
        >
          <Typography
            variant='body2'
            color='text.secondary'
          >
            No pairs added yet. Click + to add one.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {pairs.map((pair) => {
            const secretName = extractSecretName(pair.value)
            const autocompleteOptions =
              activeAutocomplete === pair.id ? getAutocompleteOptions(pair.value) : []

            return (
              <Paper
                key={pair.id}
                variant='outlined'
                sx={{
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                }}
              >
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {/* Key input */}
                  <TextInput
                    size='small'
                    fullWidth
                    id={`${pair.id}-key`}
                    value={pair.key}
                    disabled={disabled}
                    placeholder={keyPlaceholder}
                    onChange={(e) => updateKey(pair.id, e.target.value)}
                  />

                  {/* Value input with autocomplete */}
                  {activeAutocomplete === pair.id && autocompleteOptions.length > 0 ? (
                    <Autocomplete
                      freeSolo
                      size='small'
                      options={autocompleteOptions}
                      value={pair.value}
                      disabled={disabled}
                      onChange={(_, value) => {
                        if (value) {
                          handleSecretSelect(pair.id, pair.value, value)
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder={valuePlaceholder}
                          onChange={(e) =>
                            handleValueChange(pair.id, e.target.value, pair.value)
                          }
                        />
                      )}
                    />
                  ) : (
                    <Box sx={{ position: 'relative' }}>
                      <TextInput
                        size='small'
                        fullWidth
                        id={`${pair.id}-value`}
                        value={pair.value}
                        disabled={disabled}
                        placeholder={valuePlaceholder}
                        onChange={(e) =>
                          handleValueChange(pair.id, e.target.value, pair.value)
                        }
                      />
                      {enableSecretReferences && secretName && (
                        <Box sx={{ mt: 0.5 }}>
                          <Chip
                            size='small'
                            icon={<KeyIcon fontSize='small' />}
                            label={`Secret: ${secretName}`}
                            color='primary'
                            variant='outlined'
                            sx={{ fontSize: '0.75rem' }}
                          />
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>

                {/* Delete button */}
                <Tooltip title='Remove this pair'>
                  <IconButton
                    size='small'
                    onClick={() => removePair(pair.id)}
                    disabled={disabled}
                    sx={{ color: 'error.main', mt: 0.5 }}
                  >
                    <DeleteIcon fontSize='small' />
                  </IconButton>
                </Tooltip>
              </Paper>
            )
          })}
        </Box>
      )}

      {enableSecretReferences && (
        <Typography
          variant='caption'
          color='text.secondary'
          sx={{ display: 'block', mt: 1, ml: 1 }}
        >
          Tip: Type <code>{'{{'}</code> to reference a secret (e.g., {'{{'}
          <strong>API_KEY</strong>
          {'}}'})
        </Typography>
      )}
    </Box>
  )
}
