import type { TKeyValuePair } from '@TAF/types'
import type { Secret } from '@tdsk/domain'

import { CredentialOpts } from '@TAF/constants/values'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
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

export type TEndpointOAuthProps = {
  loading: boolean
  enabled: boolean
  tokenUrl: string
  clientId: string
  clientSecret: string
  scopes: string
  params: TKeyValuePair[]
  availableSecrets: Secret[]
  credentialStyle: `header` | `body`
  onScopesChange: (value: string) => void
  onEnabledChange: (value: boolean) => void
  onTokenUrlChange: (value: string) => void
  onClientIdChange: (value: string) => void
  onClientSecretChange: (value: string) => void
  onParamsChange: (pairs: TKeyValuePair[]) => void
  onCredentialStyleChange: (value: `header` | `body`) => void
}

export const EndpointOAuth = (props: TEndpointOAuthProps) => {
  const {
    scopes,
    params,
    loading,
    enabled,
    tokenUrl,
    clientId,
    clientSecret,
    onScopesChange,
    onParamsChange,
    credentialStyle,
    availableSecrets,
    onEnabledChange,
    onTokenUrlChange,
    onClientIdChange,
    onClientSecretChange,
    onCredentialStyleChange,
  } = props

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          variant='subtitle1'
          fontWeight={500}
        >
          OAuth 2.0
        </Typography>
        {enabled && (
          <Chip
            size='small'
            label='Enabled'
            color='primary'
            sx={{ ml: 1 }}
          />
        )}
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <SwitchInput
            disabled={loading}
            id='oauth-enabled'
            label='Enable OAuth 2.0'
            checked={enabled}
            onChange={(e, checked) => onEnabledChange(checked)}
          />

          {enabled && (
            <>
              <TextInput
                required
                fullWidth
                value={tokenUrl}
                id='oauth-token-url'
                label='Token URL'
                disabled={loading}
                placeholder='https://oauth.example.com/token'
                onChange={(e) => onTokenUrlChange(e.target.value)}
              />
              <TextInput
                required
                fullWidth
                value={clientId}
                id='oauth-client-id'
                label='Client ID'
                disabled={loading}
                placeholder='{{CLIENT_ID}}'
                onChange={(e) => onClientIdChange(e.target.value)}
              />
              <TextInput
                required
                fullWidth
                value={clientSecret}
                id='oauth-client-secret'
                label='Client Secret'
                disabled={loading}
                placeholder='{{CLIENT_SECRET}}'
                onChange={(e) => onClientSecretChange(e.target.value)}
              />
              <TextInput
                fullWidth
                value={scopes}
                id='oauth-scopes'
                label='Scopes'
                disabled={loading}
                placeholder='read, write, admin'
                onChange={(e) => onScopesChange(e.target.value)}
              />
              <SelectInput
                value={credentialStyle}
                id='oauth-credential-style'
                disabled={loading}
                label='Credential Style'
                onChange={(e) =>
                  onCredentialStyleChange(e.target.value as typeof credentialStyle)
                }
                items={CredentialOpts}
              />

              <Typography
                variant='body2'
                sx={{ mt: 1 }}
              >
                Additional Parameters
              </Typography>
              <KeyValueEditor
                disabled={loading}
                pairs={params}
                onChange={onParamsChange}
                secrets={availableSecrets}
                enableSecretReferences={true}
                keyPlaceholder='Parameter Name'
                valuePlaceholder='Parameter Value'
              />
            </>
          )}

          <Alert
            severity='info'
            sx={{ fontSize: '0.875rem' }}
          >
            Configure OAuth 2.0 client credentials flow. Use secret references for
            credentials.
          </Alert>
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
