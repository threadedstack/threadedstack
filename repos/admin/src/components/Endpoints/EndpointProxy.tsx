import type { TKeyValuePair } from '@TAF/types'
import type { Secret } from '@tdsk/domain'

import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Alert,
  Box,
  Accordion,
  Typography,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
import { TextInput, SelectInput, SwitchInput } from '@tdsk/components'
import { HttpMethodOps, AuthTypes, CredentialOpts } from '@TAF/constants/values'

export type TEndpointProxy = {
  loading: boolean
  // Basic fields
  url: string
  method: string
  onUrlChange: (value: string) => void
  onMethodChange: (value: string) => void

  // Headers
  headers: TKeyValuePair[]
  onHeadersChange: (pairs: TKeyValuePair[]) => void

  // Basic options
  timeout: string
  retries: string
  pathRegex: string
  onTimeoutChange: (value: string) => void
  onRetriesChange: (value: string) => void
  onPathRegexChange: (value: string) => void

  // Retry configuration
  retryDelay: string
  retryMaxDelay: string
  retryBackoffMultiplier: string
  retryExponentialBackoff: boolean
  onRetryDelayChange: (value: string) => void
  onRetryMaxDelayChange: (value: string) => void
  onRetryBackoffMultiplierChange: (value: string) => void
  onRetryExponentialBackoffChange: (value: boolean) => void

  // Auth
  authEnabled: boolean
  authType: `bearer` | `basic` | `apikey`
  authSecretName: string
  authHeaderName: string
  onAuthEnabledChange: (value: boolean) => void
  onAuthTypeChange: (value: `bearer` | `basic` | `apikey`) => void
  onAuthSecretNameChange: (value: string) => void
  onAuthHeaderNameChange: (value: string) => void

  // OAuth
  oauthEnabled: boolean
  oauthTokenUrl: string
  oauthClientId: string
  oauthClientSecret: string
  oauthScopes: string
  oauthCredentialStyle: `header` | `body`
  oauthParams: TKeyValuePair[]
  onOauthEnabledChange: (value: boolean) => void
  onOauthTokenUrlChange: (value: string) => void
  onOauthClientIdChange: (value: string) => void
  onOauthClientSecretChange: (value: string) => void
  onOauthScopesChange: (value: string) => void
  onOauthCredentialStyleChange: (value: `header` | `body`) => void
  onOauthParamsChange: (pairs: TKeyValuePair[]) => void

  // Transform
  transformEnabled: boolean
  transformInjectSecrets: boolean
  onTransformEnabledChange: (value: boolean) => void
  onTransformInjectSecretsChange: (value: boolean) => void

  // Domain whitelist
  whitelistEnabled: boolean
  whitelistDomains: string
  whitelistEnforce: boolean
  whitelistLogBlocked: boolean
  onWhitelistEnabledChange: (value: boolean) => void
  onWhitelistDomainsChange: (value: string) => void
  onWhitelistEnforceChange: (value: boolean) => void
  onWhitelistLogBlockedChange: (value: boolean) => void

  // Available secrets
  availableSecrets: Secret[]
}

export const EndpointProxy = (props: TEndpointProxy) => {
  const { loading, availableSecrets } = props

  return (
    <>
      {/* Proxy URL and Method */}
      <TextInput
        required
        fullWidth
        value={props.url}
        id='endpoint-url'
        label='Proxy URL'
        disabled={loading}
        onChange={(e) => props.onUrlChange(e.target.value)}
        placeholder='https://api.example.com/v1/users'
      />

      <SelectInput
        required
        id='method-select'
        disabled={loading}
        label='HTTP Method'
        items={HttpMethodOps}
        value={props.method.toLowerCase()}
        onChange={(e) => props.onMethodChange(e.target.value)}
      />

      {/* Headers */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography
            variant='subtitle1'
            fontWeight={500}
          >
            Headers
          </Typography>
          {props.headers.length > 0 && (
            <Chip
              size='small'
              label={props.headers.length}
              sx={{ ml: 1 }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <KeyValueEditor
              pairs={props.headers}
              disabled={loading}
              secrets={availableSecrets}
              keyPlaceholder='Header Name'
              valuePlaceholder='Header Value or {{secret-name}}'
              enableSecretReferences={true}
              onChange={props.onHeadersChange}
            />
            <Alert
              severity='info'
              sx={{ fontSize: '0.875rem' }}
            >
              Custom headers included in proxied requests. Use {'{{'} and {'}}'} to
              reference secrets.
            </Alert>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Basic Options */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography
            variant='subtitle1'
            fontWeight={500}
          >
            Basic Options
          </Typography>
          {(props.timeout || props.retries || props.pathRegex) && (
            <Chip
              size='small'
              label='Configured'
              color='primary'
              sx={{ ml: 1 }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextInput
              fullWidth
              type='number'
              value={props.timeout}
              id='endpoint-timeout'
              label='Timeout (ms)'
              disabled={loading}
              placeholder='30000'
              onChange={(e) => props.onTimeoutChange(e.target.value)}
            />
            <TextInput
              fullWidth
              type='number'
              value={props.retries}
              id='endpoint-retries'
              label='Max Retries'
              disabled={loading}
              placeholder='3'
              onChange={(e) => props.onRetriesChange(e.target.value)}
            />

            {props.retries && Number.parseInt(props.retries, 10) > 0 && (
              <>
                <Typography
                  variant='body2'
                  sx={{ mt: 1, fontWeight: 500 }}
                >
                  Retry Configuration
                </Typography>
                <TextInput
                  fullWidth
                  type='number'
                  value={props.retryDelay}
                  disabled={loading}
                  placeholder='1000'
                  id='endpoint-retry-delay'
                  label='Initial Retry Delay (ms)'
                  onChange={(e) => props.onRetryDelayChange(e.target.value)}
                />
                <TextInput
                  fullWidth
                  type='number'
                  disabled={loading}
                  placeholder='30000'
                  value={props.retryMaxDelay}
                  id='endpoint-retry-max-delay'
                  label='Max Retry Delay (ms)'
                  onChange={(e) => props.onRetryMaxDelayChange(e.target.value)}
                />
                <TextInput
                  fullWidth
                  type='number'
                  placeholder='2'
                  disabled={loading}
                  label='Backoff Multiplier'
                  value={props.retryBackoffMultiplier}
                  id='endpoint-retry-backoff-multiplier'
                  onChange={(e) => props.onRetryBackoffMultiplierChange(e.target.value)}
                />
                <SwitchInput
                  disabled={loading}
                  label='Exponential Backoff'
                  id='retry-exponential-backoff'
                  checked={props.retryExponentialBackoff}
                  onChange={(e, checked) =>
                    props.onRetryExponentialBackoffChange(checked)
                  }
                />
                <Alert
                  severity='info'
                  sx={{ fontSize: '0.875rem' }}
                >
                  {props.retryExponentialBackoff
                    ? `Retry delays increase exponentially (${props.retryDelay || '1000'}ms → ${
                        Number.parseInt(props.retryDelay || '1000', 10) *
                          Number.parseFloat(props.retryBackoffMultiplier || '2') || '2000'
                      }ms → ${
                        Number.parseInt(props.retryDelay || '1000', 10) *
                          Math.pow(
                            Number.parseFloat(props.retryBackoffMultiplier || '2'),
                            2
                          ) || '4000'
                      }ms...)`
                    : `Fixed delay of ${props.retryDelay || '1000'}ms between retries`}
                </Alert>
              </>
            )}

            <TextInput
              fullWidth
              value={props.pathRegex}
              label='Path Regex'
              disabled={loading}
              placeholder='/api/v1/.*'
              id='endpoint-path-regex'
              onChange={(e) => props.onPathRegexChange(e.target.value)}
            />
            <Alert
              severity='info'
              sx={{ fontSize: '0.875rem' }}
            >
              Configure request timeout, retry behavior with exponential backoff, and path
              pattern matching.
            </Alert>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Authentication */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography
            variant='subtitle1'
            fontWeight={500}
          >
            Authentication
          </Typography>
          {props.authEnabled && (
            <Chip
              size='small'
              color='primary'
              sx={{ ml: 1 }}
              label={props.authType.toUpperCase()}
            />
          )}
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <SwitchInput
              disabled={loading}
              id='auth-enabled'
              checked={props.authEnabled}
              label='Enable Authentication'
              onChange={(e, checked) => props.onAuthEnabledChange(checked)}
            />

            {props.authEnabled && (
              <>
                <SelectInput
                  id='auth-type'
                  value={props.authType}
                  items={AuthTypes}
                  disabled={loading}
                  label='Auth Type'
                  onChange={(e) =>
                    props.onAuthTypeChange(e.target.value as typeof props.authType)
                  }
                />
                <TextInput
                  fullWidth
                  disabled={loading}
                  label='Secret Name'
                  id='auth-secret-name'
                  value={props.authSecretName}
                  placeholder='API_KEY or {{API_KEY}}'
                  onChange={(e) => props.onAuthSecretNameChange(e.target.value)}
                />
                <TextInput
                  fullWidth
                  disabled={loading}
                  label='Header Name'
                  id='auth-header-name'
                  value={props.authHeaderName}
                  placeholder='Authorization'
                  onChange={(e) => props.onAuthHeaderNameChange(e.target.value)}
                />
              </>
            )}

            <Alert
              severity='info'
              sx={{ fontSize: '0.875rem' }}
            >
              Configure authentication using secrets. Secret value will be injected into
              the specified header.
            </Alert>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* OAuth 2.0 */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography
            variant='subtitle1'
            fontWeight={500}
          >
            OAuth 2.0
          </Typography>
          {props.oauthEnabled && (
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
              checked={props.oauthEnabled}
              onChange={(e, checked) => props.onOauthEnabledChange(checked)}
            />

            {props.oauthEnabled && (
              <>
                <TextInput
                  required
                  fullWidth
                  value={props.oauthTokenUrl}
                  id='oauth-token-url'
                  label='Token URL'
                  disabled={loading}
                  placeholder='https://oauth.example.com/token'
                  onChange={(e) => props.onOauthTokenUrlChange(e.target.value)}
                />
                <TextInput
                  required
                  fullWidth
                  value={props.oauthClientId}
                  id='oauth-client-id'
                  label='Client ID'
                  disabled={loading}
                  placeholder='{{CLIENT_ID}}'
                  onChange={(e) => props.onOauthClientIdChange(e.target.value)}
                />
                <TextInput
                  required
                  fullWidth
                  value={props.oauthClientSecret}
                  id='oauth-client-secret'
                  label='Client Secret'
                  disabled={loading}
                  placeholder='{{CLIENT_SECRET}}'
                  onChange={(e) => props.onOauthClientSecretChange(e.target.value)}
                />
                <TextInput
                  fullWidth
                  value={props.oauthScopes}
                  id='oauth-scopes'
                  label='Scopes'
                  disabled={loading}
                  placeholder='read, write, admin'
                  onChange={(e) => props.onOauthScopesChange(e.target.value)}
                />
                <SelectInput
                  value={props.oauthCredentialStyle}
                  id='oauth-credential-style'
                  disabled={loading}
                  label='Credential Style'
                  onChange={(e) =>
                    props.onOauthCredentialStyleChange(
                      e.target.value as typeof props.oauthCredentialStyle
                    )
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
                  pairs={props.oauthParams}
                  onChange={props.onOauthParamsChange}
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

      {/* Transform */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography
            variant='subtitle1'
            fontWeight={500}
          >
            Transform
          </Typography>
          {props.transformEnabled && (
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
              id='transform-enabled'
              label='Enable Transform'
              checked={props.transformEnabled}
              onChange={(e, checked) => props.onTransformEnabledChange(checked)}
            />

            {props.transformEnabled && (
              <SwitchInput
                disabled={loading}
                id='transform-inject-secrets'
                label='Inject Secrets in Body'
                checked={props.transformInjectSecrets}
                onChange={(e, checked) => props.onTransformInjectSecretsChange(checked)}
              />
            )}

            <Alert
              severity='info'
              sx={{ fontSize: '0.875rem' }}
            >
              Transform request/response bodies. Secret injection replaces {'{{'} and{' '}
              {' }}'} references.
            </Alert>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Domain Whitelist */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography
            variant='subtitle1'
            fontWeight={500}
          >
            Domain Whitelist
          </Typography>
          {props.whitelistEnabled && (
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
              id='whitelist-enabled'
              label='Enable Domain Whitelist'
              checked={props.whitelistEnabled}
              onChange={(e, checked) => props.onWhitelistEnabledChange(checked)}
            />

            {props.whitelistEnabled && (
              <>
                <TextInput
                  fullWidth
                  value={props.whitelistDomains}
                  id='whitelist-domains'
                  label='Allowed Domains'
                  disabled={loading}
                  placeholder='example.com, *.api.example.com'
                  onChange={(e) => props.onWhitelistDomainsChange(e.target.value)}
                />
                <SwitchInput
                  disabled={loading}
                  id='whitelist-enforce'
                  label='Enforce Whitelist'
                  checked={props.whitelistEnforce}
                  onChange={(e, checked) => props.onWhitelistEnforceChange(checked)}
                />
                <SwitchInput
                  disabled={loading}
                  id='whitelist-log-blocked'
                  label='Log Blocked Attempts'
                  checked={props.whitelistLogBlocked}
                  onChange={(e, checked) => props.onWhitelistLogBlockedChange(checked)}
                />
              </>
            )}

            <Alert
              severity='info'
              sx={{ fontSize: '0.875rem' }}
            >
              Restrict endpoint access to specific domains. Supports wildcards
              (*.example.com).
            </Alert>
          </Box>
        </AccordionDetails>
      </Accordion>
    </>
  )
}
