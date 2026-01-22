import type { Endpoint, TEndpointOpts } from '@tdsk/domain'

import { useState, useEffect } from 'react'
import { getSecrets } from '@TAF/state/accessors'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'
import { HttpMethods, AuthTypes, CredentialOpts } from '@TAF/constants/values'
import { Dialog, TextInput, SelectInput, SwitchInput } from '@tdsk/components'
import type { TKeyValuePair } from '@TAF/components/KeyValueEditor'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
import { createEndpoint, updateEndpoint, deleteEndpoint } from '@TAF/actions/endpoints'
import { ConfirmDeleteAlert } from '@TAF/components/ConfirmDeleteAlert/ConfirmDeleteAlert'
import {
  Box,
  Alert,
  Chip,
  Button,
  Accordion,
  Typography,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

export type TEndpointDialog = {
  open: boolean
  projectId: string
  endpoint?: Endpoint | null
  onClose: () => void
  onSuccess?: () => void
}

export const EndpointDialog = (props: TEndpointDialog) => {
  const { open, endpoint, projectId, onClose: onCloseCB, onSuccess: onSuccessCB } = props

  const isEditMode = Boolean(endpoint)

  // Basic fields
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [method, setMethod] = useState<string>(`Get`)
  const [error, setError] = useState<string | null>(null)
  const [publicEndpoint, setPublicEndpoint] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Headers
  const [headerPairs, setHeaderPairs] = useState<TKeyValuePair[]>([])

  // Options - Basic
  const [timeout, setTimeout] = useState<string>('')
  const [retries, setRetries] = useState<string>('')
  const [pathRegex, setPathRegex] = useState('')

  // Options - Retry Configuration
  const [retryDelay, setRetryDelay] = useState<string>('')
  const [retryMaxDelay, setRetryMaxDelay] = useState<string>('')
  const [retryBackoffMultiplier, setRetryBackoffMultiplier] = useState<string>('')
  const [retryExponentialBackoff, setRetryExponentialBackoff] = useState(true)

  // Options - Auth
  const [authEnabled, setAuthEnabled] = useState(false)
  const [authType, setAuthType] = useState<'bearer' | 'basic' | 'apikey'>('bearer')
  const [authSecretName, setAuthSecretName] = useState('')
  const [authHeaderName, setAuthHeaderName] = useState('')

  // Options - OAuth
  const [oauthEnabled, setOauthEnabled] = useState(false)
  const [oauthTokenUrl, setOauthTokenUrl] = useState('')
  const [oauthClientId, setOauthClientId] = useState('')
  const [oauthClientSecret, setOauthClientSecret] = useState('')
  const [oauthScopes, setOauthScopes] = useState('')
  const [oauthCredentialStyle, setOauthCredentialStyle] = useState<'header' | 'body'>(
    'header'
  )
  const [oauthParams, setOauthParams] = useState<TKeyValuePair[]>([])

  // Options - Transform
  const [transformEnabled, setTransformEnabled] = useState(false)
  const [transformInjectSecrets, setTransformInjectSecrets] = useState(false)

  // Options - Domain Whitelist
  const [whitelistEnabled, setWhitelistEnabled] = useState(false)
  const [whitelistDomains, setWhitelistDomains] = useState('')
  const [whitelistEnforce, setWhitelistEnforce] = useState(true)
  const [whitelistLogBlocked, setWhitelistLogBlocked] = useState(true)

  // Get available secrets for autocomplete
  const secretsMap = getSecrets()
  const availableSecrets = secretsMap ? Object.values(secretsMap) : []

  useEffect(() => {
    if (endpoint) {
      // Basic fields
      setName(endpoint.name || '')
      setPath(endpoint.url || '')
      setMethod(endpoint.method || `Get`)
      setPublicEndpoint(endpoint.public || false)
      setError(null)
      setShowDeleteConfirm(false)

      // Convert headers object to array of pairs
      const headers = endpoint.headers || {}
      const pairs: TKeyValuePair[] = Object.entries(headers).map(
        ([key, value], index) => ({
          id: `header-${index}-${Date.now()}`,
          key,
          value,
        })
      )
      setHeaderPairs(pairs)

      // Options
      const opts = endpoint.options || {}

      // Basic options
      setTimeout(opts.timeout?.toString() || '')
      setRetries(opts.retries?.toString() || '')
      setPathRegex(opts.pathRegex || '')

      // Retry configuration
      setRetryDelay(opts.retryDelay?.toString() || '')
      setRetryMaxDelay(opts.retryMaxDelay?.toString() || '')
      setRetryBackoffMultiplier(opts.retryBackoffMultiplier?.toString() || '')
      setRetryExponentialBackoff(opts.retryExponentialBackoff !== false)

      // Auth options
      if (opts.auth) {
        setAuthEnabled(true)
        setAuthType(opts.auth.type || 'bearer')
        setAuthSecretName(opts.auth.secretName || '')
        setAuthHeaderName(opts.auth.headerName || '')
      } else {
        setAuthEnabled(false)
        setAuthType('bearer')
        setAuthSecretName('')
        setAuthHeaderName('')
      }

      // OAuth options
      if (opts.oauth) {
        setOauthEnabled(true)
        setOauthTokenUrl(opts.oauth.tokenUrl || '')
        setOauthClientId(opts.oauth.clientId || '')
        setOauthClientSecret(opts.oauth.clientSecret || '')
        setOauthScopes(opts.oauth.scopes?.join(', ') || '')
        setOauthCredentialStyle(opts.oauth.credentialStyle || 'header')

        const oauthPairs: TKeyValuePair[] = Object.entries(
          opts.oauth.additionalParams || {}
        ).map(([key, value], index) => ({
          id: `oauth-param-${index}-${Date.now()}`,
          key,
          value,
        }))
        setOauthParams(oauthPairs)
      } else {
        setOauthEnabled(false)
        setOauthTokenUrl('')
        setOauthClientId('')
        setOauthClientSecret('')
        setOauthScopes('')
        setOauthCredentialStyle('header')
        setOauthParams([])
      }

      // Transform options
      if (opts.transform) {
        setTransformEnabled(true)
        setTransformInjectSecrets(opts.transform.injectSecrets || false)
      } else {
        setTransformEnabled(false)
        setTransformInjectSecrets(false)
      }

      // Domain whitelist options
      if (opts.domainWhitelist) {
        setWhitelistEnabled(true)
        setWhitelistDomains(opts.domainWhitelist.allowedDomains?.join(', ') || '')
        setWhitelistEnforce(opts.domainWhitelist.enforceWhitelist !== false)
        setWhitelistLogBlocked(opts.domainWhitelist.logBlocked !== false)
      } else {
        setWhitelistEnabled(false)
        setWhitelistDomains('')
        setWhitelistEnforce(true)
        setWhitelistLogBlocked(true)
      }
    } else {
      // Reset all fields
      setName('')
      setPath('')
      setError(null)
      setMethod(`Get`)
      setPublicEndpoint(false)
      setShowDeleteConfirm(false)
      setHeaderPairs([])
      setTimeout('')
      setRetries('')
      setPathRegex('')
      setRetryDelay('')
      setRetryMaxDelay('')
      setRetryBackoffMultiplier('')
      setRetryExponentialBackoff(true)
      setAuthEnabled(false)
      setAuthType('bearer')
      setAuthSecretName('')
      setAuthHeaderName('')
      setOauthEnabled(false)
      setOauthTokenUrl('')
      setOauthClientId('')
      setOauthClientSecret('')
      setOauthScopes('')
      setOauthCredentialStyle('header')
      setOauthParams([])
      setTransformEnabled(false)
      setTransformInjectSecrets(false)
      setWhitelistEnabled(false)
      setWhitelistDomains('')
      setWhitelistEnforce(true)
      setWhitelistLogBlocked(true)
    }
  }, [endpoint])

  const onClose = () => {
    if (!loading) {
      setName(``)
      setPath(``)
      setError(null)
      setMethod(`Get`)
      setPublicEndpoint(false)
      setShowDeleteConfirm(false)
      setHeaderPairs([])
      setTimeout('')
      setRetries('')
      setPathRegex('')
      setRetryDelay('')
      setRetryMaxDelay('')
      setRetryBackoffMultiplier('')
      setRetryExponentialBackoff(true)
      setAuthEnabled(false)
      setAuthType('bearer')
      setAuthSecretName('')
      setAuthHeaderName('')
      setOauthEnabled(false)
      setOauthTokenUrl('')
      setOauthClientId('')
      setOauthClientSecret('')
      setOauthScopes('')
      setOauthCredentialStyle('header')
      setOauthParams([])
      setTransformEnabled(false)
      setTransformInjectSecrets(false)
      setWhitelistEnabled(false)
      setWhitelistDomains('')
      setWhitelistEnforce(true)
      setWhitelistLogBlocked(true)
      onCloseCB?.()
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Endpoint name is required')
      return
    }

    if (!path.trim()) {
      setError('Proxy URL is required')
      return
    }

    setLoading(true)
    setError(null)

    // Convert header pairs to object
    const headers: Record<string, string> = {}
    headerPairs.forEach((pair) => {
      if (pair.key.trim() && pair.value.trim()) {
        headers[pair.key.trim()] = pair.value.trim()
      }
    })

    // Build options object
    const options: TEndpointOpts = {}

    // Basic options
    if (timeout) options.timeout = Number.parseInt(timeout, 10)
    if (retries) options.retries = Number.parseInt(retries, 10)
    if (pathRegex) options.pathRegex = pathRegex

    // Retry configuration
    if (retryDelay) options.retryDelay = Number.parseInt(retryDelay, 10)
    if (retryMaxDelay) options.retryMaxDelay = Number.parseInt(retryMaxDelay, 10)
    if (retryBackoffMultiplier)
      options.retryBackoffMultiplier = Number.parseFloat(retryBackoffMultiplier)
    if (retries) options.retryExponentialBackoff = retryExponentialBackoff

    // Auth options
    if (authEnabled) {
      options.auth = {
        type: authType,
        secretName: authSecretName || undefined,
        headerName: authHeaderName || undefined,
      }
    }

    // OAuth options
    if (oauthEnabled && oauthTokenUrl && oauthClientId && oauthClientSecret) {
      const additionalParams: Record<string, string> = {}
      oauthParams.forEach((pair) => {
        if (pair.key.trim() && pair.value.trim()) {
          additionalParams[pair.key.trim()] = pair.value.trim()
        }
      })

      options.oauth = {
        tokenUrl: oauthTokenUrl,
        clientId: oauthClientId,
        clientSecret: oauthClientSecret,
        scopes: oauthScopes
          ? oauthScopes
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
        credentialStyle: oauthCredentialStyle,
        additionalParams:
          Object.keys(additionalParams).length > 0 ? additionalParams : undefined,
      }
    }

    // Transform options
    if (transformEnabled) {
      options.transform = {
        injectSecrets: transformInjectSecrets,
        // Note: rules would need a separate complex UI component
      }
    }

    // Domain whitelist options
    if (whitelistEnabled && whitelistDomains) {
      options.domainWhitelist = {
        allowedDomains: whitelistDomains
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean),
        enforceWhitelist: whitelistEnforce,
        logBlocked: whitelistLogBlocked,
      }
    }

    const result =
      isEditMode && endpoint
        ? await updateEndpoint(endpoint.id, {
            method,
            headers,
            options,
            projectId,
            name: name.trim(),
            path: path.trim(),
            public: publicEndpoint,
          })
        : await createEndpoint({
            method,
            headers,
            options,
            projectId,
            name: name.trim(),
            path: path.trim(),
            public: publicEndpoint,
          })

    setLoading(false)

    if (result.error) {
      const errorMessage = isEditMode
        ? `Failed to update endpoint. Please try again.`
        : `Failed to create endpoint. Please try again.`
      setError(result.error.message || errorMessage)
    } else {
      onClose()
      onSuccessCB?.()
    }
  }

  const onDelete = async () => {
    if (!endpoint) return

    setLoading(true)
    setError(null)

    const result = await deleteEndpoint(endpoint.id)

    setLoading(false)

    if (result.error) {
      setError(result.error.message || `Failed to delete endpoint. Please try again.`)
      setShowDeleteConfirm(false)
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='md'
      title={isEditMode ? 'Edit Endpoint' : 'Create New Endpoint'}
      content={
        <form
          id='endpoint-form'
          onSubmit={onSubmit}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && (
              <ErrorAlert
                message={error}
                onClose={() => setError(null)}
              />
            )}

            {showDeleteConfirm && (
              <ConfirmDeleteAlert
                deleting={loading}
                onConfirm={onDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                itemName={name}
              />
            )}

            {/* Basic Configuration */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextInput
                required
                fullWidth
                value={name}
                id='endpoint-name'
                disabled={loading}
                label='Endpoint Name'
                placeholder='Enter endpoint name'
                onChange={(e) => setName(e.target.value)}
              />

              <TextInput
                required
                fullWidth
                value={path}
                id='endpoint-url'
                label='Proxy URL'
                disabled={loading}
                placeholder='https://api.example.com/v1/users'
                onChange={(e) => setPath(e.target.value)}
              />

              <SelectInput
                required
                value={method}
                id='method-select'
                disabled={loading}
                label='HTTP Method'
                onChange={(e) => setMethod(e.target.value)}
                items={HttpMethods.map((m) => ({ value: m, label: m }))}
              />

              <SwitchInput
                disabled={loading}
                id='public-endpoint'
                label='Public Endpoint'
                checked={publicEndpoint}
                onChange={(e, checked) => setPublicEndpoint(checked)}
              />
              <Box sx={{ ml: 4, mt: -1 }}>
                <Alert
                  severity='info'
                  sx={{ fontSize: `0.875rem` }}
                >
                  {publicEndpoint
                    ? `Accessible without authentication`
                    : `Requires authentication`}
                </Alert>
              </Box>
            </Box>

            {/* Advanced Configuration */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography
                  variant='subtitle1'
                  fontWeight={500}
                >
                  Headers
                </Typography>
                {headerPairs.length > 0 && (
                  <Chip
                    size='small'
                    label={headerPairs.length}
                    sx={{ ml: 1 }}
                  />
                )}
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <KeyValueEditor
                    pairs={headerPairs}
                    disabled={loading}
                    secrets={availableSecrets}
                    keyPlaceholder='Header Name'
                    valuePlaceholder='Header Value or {{secret-name}}'
                    enableSecretReferences={true}
                    onChange={setHeaderPairs}
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

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography
                  variant='subtitle1'
                  fontWeight={500}
                >
                  Basic Options
                </Typography>
                {(timeout || retries || pathRegex) && (
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
                    value={timeout}
                    id='endpoint-timeout'
                    label='Timeout (ms)'
                    disabled={loading}
                    placeholder='30000'
                    onChange={(e) => setTimeout(e.target.value)}
                  />
                  <TextInput
                    fullWidth
                    type='number'
                    value={retries}
                    id='endpoint-retries'
                    label='Max Retries'
                    disabled={loading}
                    placeholder='3'
                    onChange={(e) => setRetries(e.target.value)}
                  />

                  {retries && Number.parseInt(retries, 10) > 0 && (
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
                        value={retryDelay}
                        id='endpoint-retry-delay'
                        label='Initial Retry Delay (ms)'
                        disabled={loading}
                        placeholder='1000'
                        onChange={(e) => setRetryDelay(e.target.value)}
                      />
                      <TextInput
                        fullWidth
                        type='number'
                        value={retryMaxDelay}
                        id='endpoint-retry-max-delay'
                        label='Max Retry Delay (ms)'
                        disabled={loading}
                        placeholder='30000'
                        onChange={(e) => setRetryMaxDelay(e.target.value)}
                      />
                      <TextInput
                        fullWidth
                        type='number'
                        value={retryBackoffMultiplier}
                        id='endpoint-retry-backoff-multiplier'
                        label='Backoff Multiplier'
                        disabled={loading}
                        placeholder='2'
                        onChange={(e) => setRetryBackoffMultiplier(e.target.value)}
                      />
                      <SwitchInput
                        disabled={loading}
                        id='retry-exponential-backoff'
                        label='Exponential Backoff'
                        checked={retryExponentialBackoff}
                        onChange={(e, checked) => setRetryExponentialBackoff(checked)}
                      />
                      <Alert
                        severity='info'
                        sx={{ fontSize: '0.875rem' }}
                      >
                        {retryExponentialBackoff
                          ? `Retry delays increase exponentially (${retryDelay || '1000'}ms → ${
                              Number.parseInt(retryDelay || '1000', 10) *
                                Number.parseFloat(retryBackoffMultiplier || '2') || '2000'
                            }ms → ${
                              Number.parseInt(retryDelay || '1000', 10) *
                                Math.pow(
                                  Number.parseFloat(retryBackoffMultiplier || '2'),
                                  2
                                ) || '4000'
                            }ms...)`
                          : `Fixed delay of ${retryDelay || '1000'}ms between retries`}
                      </Alert>
                    </>
                  )}

                  <TextInput
                    fullWidth
                    value={pathRegex}
                    id='endpoint-path-regex'
                    label='Path Regex'
                    disabled={loading}
                    placeholder='/api/v1/.*'
                    onChange={(e) => setPathRegex(e.target.value)}
                  />
                  <Alert
                    severity='info'
                    sx={{ fontSize: '0.875rem' }}
                  >
                    Configure request timeout, retry behavior with exponential backoff,
                    and path pattern matching.
                  </Alert>
                </Box>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography
                  variant='subtitle1'
                  fontWeight={500}
                >
                  Authentication
                </Typography>
                {authEnabled && (
                  <Chip
                    size='small'
                    label={authType.toUpperCase()}
                    color='primary'
                    sx={{ ml: 1 }}
                  />
                )}
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <SwitchInput
                    disabled={loading}
                    id='auth-enabled'
                    label='Enable Authentication'
                    checked={authEnabled}
                    onChange={(e, checked) => setAuthEnabled(checked)}
                  />

                  {authEnabled && (
                    <>
                      <SelectInput
                        value={authType}
                        id='auth-type'
                        disabled={loading}
                        label='Auth Type'
                        onChange={(e) => setAuthType(e.target.value as typeof authType)}
                        items={AuthTypes}
                      />
                      <TextInput
                        fullWidth
                        value={authSecretName}
                        id='auth-secret-name'
                        label='Secret Name'
                        disabled={loading}
                        placeholder='API_KEY or {{API_KEY}}'
                        onChange={(e) => setAuthSecretName(e.target.value)}
                      />
                      <TextInput
                        fullWidth
                        value={authHeaderName}
                        id='auth-header-name'
                        label='Header Name'
                        disabled={loading}
                        placeholder='Authorization'
                        onChange={(e) => setAuthHeaderName(e.target.value)}
                      />
                    </>
                  )}

                  <Alert
                    severity='info'
                    sx={{ fontSize: '0.875rem' }}
                  >
                    Configure authentication using secrets. Secret value will be injected
                    into the specified header.
                  </Alert>
                </Box>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography
                  variant='subtitle1'
                  fontWeight={500}
                >
                  OAuth 2.0
                </Typography>
                {oauthEnabled && (
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
                    checked={oauthEnabled}
                    onChange={(e, checked) => setOauthEnabled(checked)}
                  />

                  {oauthEnabled && (
                    <>
                      <TextInput
                        required
                        fullWidth
                        value={oauthTokenUrl}
                        id='oauth-token-url'
                        label='Token URL'
                        disabled={loading}
                        placeholder='https://oauth.example.com/token'
                        onChange={(e) => setOauthTokenUrl(e.target.value)}
                      />
                      <TextInput
                        required
                        fullWidth
                        value={oauthClientId}
                        id='oauth-client-id'
                        label='Client ID'
                        disabled={loading}
                        placeholder='{{CLIENT_ID}}'
                        onChange={(e) => setOauthClientId(e.target.value)}
                      />
                      <TextInput
                        required
                        fullWidth
                        value={oauthClientSecret}
                        id='oauth-client-secret'
                        label='Client Secret'
                        disabled={loading}
                        placeholder='{{CLIENT_SECRET}}'
                        onChange={(e) => setOauthClientSecret(e.target.value)}
                      />
                      <TextInput
                        fullWidth
                        value={oauthScopes}
                        id='oauth-scopes'
                        label='Scopes'
                        disabled={loading}
                        placeholder='read, write, admin'
                        onChange={(e) => setOauthScopes(e.target.value)}
                      />
                      <SelectInput
                        value={oauthCredentialStyle}
                        id='oauth-credential-style'
                        disabled={loading}
                        label='Credential Style'
                        onChange={(e) =>
                          setOauthCredentialStyle(
                            e.target.value as typeof oauthCredentialStyle
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
                        pairs={oauthParams}
                        disabled={loading}
                        secrets={availableSecrets}
                        keyPlaceholder='Parameter Name'
                        valuePlaceholder='Parameter Value'
                        enableSecretReferences={true}
                        onChange={setOauthParams}
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

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography
                  variant='subtitle1'
                  fontWeight={500}
                >
                  Transform
                </Typography>
                {transformEnabled && (
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
                    checked={transformEnabled}
                    onChange={(e, checked) => setTransformEnabled(checked)}
                  />

                  {transformEnabled && (
                    <SwitchInput
                      disabled={loading}
                      id='transform-inject-secrets'
                      label='Inject Secrets in Body'
                      checked={transformInjectSecrets}
                      onChange={(e, checked) => setTransformInjectSecrets(checked)}
                    />
                  )}

                  <Alert
                    severity='info'
                    sx={{ fontSize: '0.875rem' }}
                  >
                    Transform request/response bodies. Secret injection replaces {'{{'}{' '}
                    and {'}}'} references.
                  </Alert>
                </Box>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography
                  variant='subtitle1'
                  fontWeight={500}
                >
                  Domain Whitelist
                </Typography>
                {whitelistEnabled && (
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
                    checked={whitelistEnabled}
                    onChange={(e, checked) => setWhitelistEnabled(checked)}
                  />

                  {whitelistEnabled && (
                    <>
                      <TextInput
                        fullWidth
                        value={whitelistDomains}
                        id='whitelist-domains'
                        label='Allowed Domains'
                        disabled={loading}
                        placeholder='example.com, *.api.example.com'
                        onChange={(e) => setWhitelistDomains(e.target.value)}
                      />
                      <SwitchInput
                        disabled={loading}
                        id='whitelist-enforce'
                        label='Enforce Whitelist'
                        checked={whitelistEnforce}
                        onChange={(e, checked) => setWhitelistEnforce(checked)}
                      />
                      <SwitchInput
                        disabled={loading}
                        id='whitelist-log-blocked'
                        label='Log Blocked Attempts'
                        checked={whitelistLogBlocked}
                        onChange={(e, checked) => setWhitelistLogBlocked(checked)}
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
          </Box>
        </form>
      }
      actionProps={
        isEditMode ? { sx: { justifyContent: 'space-between', px: 3, pb: 2 } } : undefined
      }
      actions={
        <>
          {isEditMode && (
            <Button
              color='error'
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading || showDeleteConfirm}
            >
              Delete
            </Button>
          )}
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              ml: isEditMode ? 'auto' : undefined,
            }}
          >
            <Button
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <LoadingButton
              type='submit'
              loading={loading}
              variant='contained'
              form='endpoint-form'
              disabled={showDeleteConfirm}
              loadingText={isEditMode ? `Saving...` : `Creating...`}
            >
              {isEditMode ? `Save Changes` : `Create Endpoint`}
            </LoadingButton>
          </Box>
        </>
      }
    />
  )
}
