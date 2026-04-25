import type { Secret, TEPAuthType } from '@tdsk/domain'

import { AuthTypes } from '@TAF/constants/values'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { TextInput, SelectInput, SwitchInput } from '@tdsk/components'
import {
  Box,
  Chip,
  Alert,
  Accordion,
  Typography,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

type TSecretItem = {
  label: string
  value: string
}

export type TEndpointAuthProps = {
  loading: boolean
  enabled: boolean
  secretId: string
  headerName: string
  secrets?: Secret[]
  type: TEPAuthType
  onEnabledChange: (value: boolean) => void
  onSecretIdChange: (value: string) => void
  onHeaderNameChange: (value: string) => void
  onTypeChange: (value: TEPAuthType) => void
}

export const EndpointAuth = (props: TEndpointAuthProps) => {
  const {
    type,
    loading,
    enabled,
    secretId,
    headerName,
    secrets = [],
    onTypeChange,
    onEnabledChange,
    onSecretIdChange,
    onHeaderNameChange,
  } = props

  const secretItems: TSecretItem[] = secrets.map((s) => ({
    label: `${s.name || s.hashKey} (${s.id})`,
    value: s.id,
  }))

  const selectedSecret = secretItems.find((s) => s.value === secretId) || null
  const secretMissing = enabled && secretId && secrets.length > 0 && !selectedSecret

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          variant='subtitle1'
          fontWeight={500}
        >
          Authentication
        </Typography>
        {enabled && (
          <Chip
            size='small'
            color='primary'
            sx={{ ml: 1 }}
            label={type.toUpperCase()}
          />
        )}
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <SwitchInput
            disabled={loading}
            id='auth-enabled'
            checked={enabled}
            label='Enable Authentication'
            onChange={(e, checked) => onEnabledChange(checked)}
          />

          {enabled && (
            <>
              <SelectInput
                id='auth-type'
                value={type}
                items={AuthTypes}
                disabled={loading}
                label='Auth Type'
                onChange={(e) => onTypeChange(e.target.value as typeof type)}
              />
              {secrets.length > 0 ? (
                <SelectInput
                  id='auth-secret'
                  label='Secret'
                  value={secretId}
                  disabled={loading}
                  items={secretItems}
                  placeholder='Select a secret'
                  onChange={(e) => onSecretIdChange(e.target.value as string)}
                />
              ) : (
                <TextInput
                  fullWidth
                  value={secretId}
                  label='Secret ID'
                  disabled={loading}
                  id='auth-secret-id'
                  placeholder='Secret ID (10-char nanoid)'
                  onChange={(e) => onSecretIdChange(e.target.value)}
                />
              )}
              {secretMissing && (
                <Alert
                  severity='warning'
                  sx={{ fontSize: '0.875rem' }}
                >
                  The referenced secret (ID: {secretId}) was not found. It may have been
                  deleted.
                </Alert>
              )}
              <TextInput
                fullWidth
                disabled={loading}
                value={headerName}
                label='Header Name'
                id='auth-header-name'
                placeholder='Authorization'
                onChange={(e) => onHeaderNameChange(e.target.value)}
              />
            </>
          )}

          <Alert
            severity='info'
            sx={{ fontSize: '0.875rem' }}
          >
            Configure authentication using secrets. Secret value will be injected into the
            specified header.
          </Alert>
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
