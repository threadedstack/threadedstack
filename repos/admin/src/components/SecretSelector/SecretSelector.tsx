import type { Secret, TSecretMode } from '@tdsk/domain'

import { useState } from 'react'
import { SecretModeOptions } from '@TAF/constants/values'
import { TextInput, SelectInput } from '@tdsk/components'
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material'
import { Box, Chip, Typography, IconButton, InputAdornment } from '@mui/material'

export type TSecretSelector = {
  label?: string
  editLabel?: string
  editing?: boolean
  disabled?: boolean
  mode: TSecretMode
  selectedSecretId: string
  newSecretValue: string
  onModeChange: (mode: TSecretMode) => void
  onSecretSelect: (id: string) => void
  onNewValueChange: (value: string) => void
  secretOptions: Array<{ value: string; label: string }>
  linkedSecrets?: Secret[]
  activeSecretId?: string
  valuePlaceholder?: string
}

export const SecretSelector = (props: TSecretSelector) => {
  const {
    label = 'Secret',
    editLabel,
    editing,
    disabled,
    mode,
    selectedSecretId,
    newSecretValue,
    onModeChange,
    onSecretSelect,
    onNewValueChange,
    secretOptions,
    linkedSecrets,
    activeSecretId,
    valuePlaceholder = 'Enter secret value...',
  } = props

  const [showValue, setShowValue] = useState(false)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant='subtitle2'>{editing ? editLabel || label : label}</Typography>

      {editing && linkedSecrets && linkedSecrets.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            gap: 0.5,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Typography
            variant='body2'
            color='text.secondary'
          >
            Linked:
          </Typography>
          {linkedSecrets.map((s) => (
            <Chip
              key={s.id}
              size='small'
              variant='outlined'
              color={activeSecretId === s.id ? 'success' : 'primary'}
              label={activeSecretId === s.id ? `${s.name} (active)` : s.name}
            />
          ))}
        </Box>
      )}

      <SelectInput
        id='secret-mode'
        value={mode}
        disabled={disabled}
        items={SecretModeOptions}
        label={editing ? editLabel || label : label}
        onChange={(e) => {
          onModeChange(e.target.value as TSecretMode)
          setShowValue(false)
        }}
      />

      {mode === 'existing' && (
        <SelectInput
          disabled={disabled}
          label='Select Secret'
          items={secretOptions}
          value={selectedSecretId}
          id='secret-existing-select'
          description='Choose an existing org-scoped secret'
          onChange={(e) => onSecretSelect(e.target.value)}
        />
      )}

      {mode === 'new' && (
        <TextInput
          required
          fullWidth
          disabled={disabled}
          value={newSecretValue}
          label='Secret Value'
          id='secret-new-value'
          type={showValue ? 'text' : 'password'}
          onChange={(e) => onNewValueChange(e.target.value)}
          placeholder={valuePlaceholder}
          endAdornment={
            <InputAdornment position='end'>
              <IconButton
                edge='end'
                disabled={disabled}
                onClick={() => setShowValue((prev) => !prev)}
                aria-label={showValue ? 'Hide value' : 'Show value'}
              >
                {showValue ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          }
        />
      )}
    </Box>
  )
}
