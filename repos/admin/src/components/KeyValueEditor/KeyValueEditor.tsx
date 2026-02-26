import type { Secret } from '@tdsk/domain'
import type { TKeyValuePair } from '@TAF/types'

import { useState } from 'react'
import { TextInput } from '@tdsk/components'
import { templates } from '@TAF/services/templates'
import { Key as KeyIcon } from '@mui/icons-material'
import { EditorList } from '@TAF/components/EditorList/EditorList'
import { Box, Chip, TextField, Typography, Autocomplete } from '@mui/material'

export type TKeyValueEditorProps = {
  label?: string
  pairs: TKeyValuePair[]
  disabled?: boolean
  placeholder?: string
  // TODO: fix this - it should be a general array of items, not secrets
  // That way it can support multiple entity types
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
    pairs,
    disabled,
    onChange,
    secrets = [],
    keyPlaceholder = `Key`,
    label = `Key-Value Pairs`,
    enableSecretReferences = true,
    valuePlaceholder = `Value or ${templates.regex.open}secret-name${templates.regex.close}`,
  } = props

  const [activeAutocomplete, setActiveAutocomplete] = useState<string | null>(null)

  const addPair = () => {
    const newPair: TKeyValuePair = {
      key: ``,
      value: ``,
      id: `kv-${Date.now()}`,
    }
    onChange([...pairs, newPair])
  }

  const removePair = (index: number) => {
    const id = pairs[index]?.id
    onChange(pairs.filter((p) => p.id !== id))
  }

  const updateKey = (id: string, key: string) => {
    onChange(pairs.map((p) => (p.id === id ? { ...p, key } : p)))
  }

  const updateValue = (id: string, value: string) => {
    onChange(pairs.map((p) => (p.id === id ? { ...p, value } : p)))
  }

  // Get autocomplete options when typing {{
  const getAutocompleteOptions = (value: string): string[] => {
    if (!enableSecretReferences || !templates.includes(value)) return []

    const match = templates.match(value)
    if (!match) return []

    const partialName = match[1].toLowerCase()
    return secrets
      .filter((s) => (s.name || s.hashKey || ``).toLowerCase().includes(partialName))
      .map((s) => s.name || s.hashKey || ``)
  }

  const onValueChange = (id: string, newValue: string, oldValue: string) => {
    templates.includes(newValue) && !templates.includes(oldValue)
      ? setActiveAutocomplete(id)
      : setActiveAutocomplete(null)

    updateValue(id, newValue)
  }

  const onSecretSelect = (id: string, currentValue: string, secretName: string) => {
    const before = templates.before(currentValue)
    const newValue = `${before}${templates.wrap(secretName)}`
    updateValue(id, newValue)
    setActiveAutocomplete(null)
  }

  return (
    <EditorList
      label={label}
      disabled={disabled}
      onAdd={addPair}
      onRemove={removePair}
      addTooltip='Add new key-value pair'
      removeTooltip='Remove this pair'
      emptyMessage='No pairs added yet. Click + to add one.'
      items={pairs.map((pair) => {
        const secretName = templates.extract(pair.value)
        const autocompleteOptions =
          activeAutocomplete === pair.id ? getAutocompleteOptions(pair.value) : []

        return {
          key: pair.id,
          content: (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <TextInput
                fullWidth
                size='small'
                value={pair.key}
                disabled={disabled}
                id={`${pair.id}-key`}
                placeholder={keyPlaceholder}
                onChange={(e) => updateKey(pair.id, e.target.value)}
              />

              {activeAutocomplete === pair.id && autocompleteOptions.length > 0 ? (
                <Autocomplete
                  freeSolo
                  size='small'
                  value={pair.value}
                  disabled={disabled}
                  options={autocompleteOptions}
                  onChange={(_, value) =>
                    value && onSecretSelect(pair.id, pair.value, value)
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={valuePlaceholder}
                      onChange={(e) => onValueChange(pair.id, e.target.value, pair.value)}
                    />
                  )}
                />
              ) : (
                <Box sx={{ position: 'relative' }}>
                  <TextInput
                    fullWidth
                    size='small'
                    value={pair.value}
                    disabled={disabled}
                    id={`${pair.id}-value`}
                    placeholder={valuePlaceholder}
                    onChange={(e) => onValueChange(pair.id, e.target.value, pair.value)}
                  />
                  {enableSecretReferences && secretName && (
                    <Box sx={{ mt: 0.5 }}>
                      <Chip
                        size='small'
                        color='primary'
                        variant='outlined'
                        sx={{ fontSize: '0.75rem' }}
                        label={`Secret: ${secretName}`}
                        icon={<KeyIcon fontSize='small' />}
                      />
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          ),
        }
      })}
      footer={
        enableSecretReferences ? (
          <Typography
            variant='caption'
            color='text.secondary'
            sx={{ display: 'block', mt: 1, ml: 1 }}
          >
            Tip: Type <code>{'{{'}</code> to reference a secret (e.g., {'{{'}
            <strong>API_KEY</strong>
            {'}}'})
          </Typography>
        ) : undefined
      }
    />
  )
}
