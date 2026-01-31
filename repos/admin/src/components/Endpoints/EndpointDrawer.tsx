import type { TKeyValuePair } from '@TAF/types'
import type {
  Endpoint,
  TEndpointOpts,
  TEndpointType,
  TFaaSEndpointConfig,
  TProxyEndpointConfig,
  TAgentEndpointConfig,
} from '@tdsk/domain'

import { Drawer } from '@tdsk/components'
import { useState, useEffect } from 'react'
import { EEndpointType } from '@tdsk/domain'
import { EndpointTypeOpts } from '@TAF/constants/values'
import { getSecrets, getFunctions } from '@TAF/state/accessors'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { EndpointAgent } from '@TAF/components/Endpoints/EndpointAgent'
import { EndpointFaas } from '@TAF/components/Endpoints/EndpointFaas'
import { EndpointProxy } from '@TAF/components/Endpoints/EndpointProxy'
import { createEndpoint } from '@TAF/actions/endpoints/api/createEndpoint'
import { updateEndpoint } from '@TAF/actions/endpoints/api/updateEndpoint'
import { deleteEndpoint } from '@TAF/actions/endpoints/api/deleteEndpoint'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'
import { TextInput, SelectInput, SwitchInput, ConfirmDelete } from '@tdsk/components'
import { Box, Alert, Button } from '@mui/material'

export type TEndpointDrawer = {
  open: boolean
  projectId: string
  onClose: () => void
  onSuccess?: () => void
  endpoint?: Endpoint | null
}

export const EndpointDrawer = (props: TEndpointDrawer) => {
  const { open, endpoint, projectId, onClose: onCloseCB, onSuccess: onSuccessCB } = props

  const isEditMode = Boolean(endpoint)

  // Endpoint type
  const [endpointType, setEndpointType] = useState<TEndpointType>(EEndpointType.proxy)

  // Basic fields
  const [url, setUrl] = useState(``)
  const [name, setName] = useState(``)
  const [path, setPath] = useState(``)
  const [loading, setLoading] = useState(false)
  const [method, setMethod] = useState<string>(`Get`)
  const [error, setError] = useState<string | null>(null)
  const [publicEndpoint, setPublicEndpoint] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Headers (proxy only)
  const [headerPairs, setHeaderPairs] = useState<TKeyValuePair[]>([])

  // Options - Basic (proxy only)
  const [pathRegex, setPathRegex] = useState(``)
  const [retries, setRetries] = useState<string>(``)
  const [timeout, setEPTimeout] = useState<string>(``)

  // Options - Retry Configuration (proxy only)
  const [retryDelay, setRetryDelay] = useState<string>(``)
  const [retryMaxDelay, setRetryMaxDelay] = useState<string>(``)
  const [retryBackoffMultiplier, setRetryBackoffMultiplier] = useState<string>(``)
  const [retryExponentialBackoff, setRetryExponentialBackoff] = useState(true)

  // Options - Auth (proxy only)
  const [authEnabled, setAuthEnabled] = useState(false)
  const [authType, setAuthType] = useState<`bearer` | `basic` | `apikey`>(`bearer`)
  const [authSecretName, setAuthSecretName] = useState(``)
  const [authHeaderName, setAuthHeaderName] = useState(``)

  // Options - OAuth (proxy only)
  const [oauthEnabled, setOauthEnabled] = useState(false)
  const [oauthTokenUrl, setOauthTokenUrl] = useState(``)
  const [oauthClientId, setOauthClientId] = useState(``)
  const [oauthClientSecret, setOauthClientSecret] = useState(``)
  const [oauthScopes, setOauthScopes] = useState(``)
  const [oauthCredentialStyle, setOauthCredentialStyle] = useState<`header` | `body`>(
    `header`
  )
  const [oauthParams, setOauthParams] = useState<TKeyValuePair[]>([])

  // Options - Transform (proxy only)
  const [transformEnabled, setTransformEnabled] = useState(false)
  const [transformInjectSecrets, setTransformInjectSecrets] = useState(false)

  // Options - Domain Whitelist (proxy only)
  const [whitelistEnabled, setWhitelistEnabled] = useState(false)
  const [whitelistDomains, setWhitelistDomains] = useState('')
  const [whitelistEnforce, setWhitelistEnforce] = useState(true)
  const [whitelistLogBlocked, setWhitelistLogBlocked] = useState(true)

  // FAAS-specific fields
  const [functionId, setFunctionId] = useState(``)
  const [faasMemory, setFaasMemory] = useState<string>(``)
  const [faasTimeout, setFaasTimeout] = useState<string>(``)
  const [faasSecrets, setFaasSecrets] = useState<string[]>([])
  const [faasEnvVars, setFaasEnvVars] = useState<TKeyValuePair[]>([])
  const [faasArguments, setFaasArguments] = useState<TKeyValuePair[]>([])

  // Agent-specific fields
  const [agentId, setAgentId] = useState(``)
  const [agentModel, setAgentModel] = useState(``)
  const [agentTools, setAgentTools] = useState<string[]>([])
  const [agentSecrets, setAgentSecrets] = useState<string[]>([])
  const [agentSystemPrompt, setAgentSystemPrompt] = useState(``)
  const [agentMaxTokens, setAgentMaxTokens] = useState<string>(``)
  const [agentEnvVars, setAgentEnvVars] = useState<TKeyValuePair[]>([])

  // Get available resources
  const secretsMap = getSecrets()
  const availableSecrets = secretsMap ? Object.values(secretsMap) : []

  const functionsMap = getFunctions()
  const availableFunctions = functionsMap ? Object.values(functionsMap) : []

  useEffect(() => {
    if (endpoint) {
      // Set endpoint type
      setEndpointType(endpoint.type || EEndpointType.proxy)

      // Basic fields
      setName(endpoint.name || ``)
      setUrl(endpoint.url || ``)
      setPath(endpoint.path || ``)
      setMethod(endpoint.method || `get`)
      setPublicEndpoint(endpoint.public || false)
      setError(null)
      setShowDeleteConfirm(false)

      // Type-specific configurations
      let opts = endpoint.options

      // Proxy only configuration
      if (endpoint.type === EEndpointType.proxy) {
        opts = endpoint.options as TProxyEndpointConfig
        if (opts.transform) {
          setTransformEnabled(true)
          setTransformInjectSecrets(opts.transform.injectSecrets || false)
        } else {
          setTransformEnabled(false)
          setTransformInjectSecrets(false)
        }
      }

      // FAAS only configuration
      if (endpoint.type === EEndpointType.faas) {
        opts = endpoint.options as TFaaSEndpointConfig
        setFunctionId(opts.functionId || ``)

        const argPairs: TKeyValuePair[] = Object.entries(opts.arguments || {}).map(
          ([key, value], index) => ({
            id: `faas-arg-${index}-${Date.now()}`,
            key,
            value: String(value),
          })
        )
        setFaasArguments(argPairs)

        const envPairs: TKeyValuePair[] = Object.entries(opts.envVars || {}).map(
          ([key, value]: [string, string], index) => ({
            id: `faas-env-${index}-${Date.now()}`,
            key,
            value,
          })
        )
        setFaasEnvVars(envPairs)

        setFaasSecrets(opts.secrets || [])
        setFaasTimeout(opts.timeout?.toString() || '')
        setFaasMemory(opts.memory?.toString() || '')
      } else {
        setFunctionId(``)
        setFaasArguments([])
        setFaasEnvVars([])
        setFaasSecrets([])
        setFaasTimeout(``)
        setFaasMemory(``)
      }

      // Agent configuration
      if (endpoint.type === EEndpointType.agent) {
        opts = endpoint.options as TAgentEndpointConfig

        setAgentId(opts.agentId || '')

        if (opts.overrides) {
          setAgentSystemPrompt(opts.overrides.systemPrompt || '')
          setAgentModel(opts.overrides.model || '')
          setAgentMaxTokens(opts.overrides.maxTokens?.toString() || '')
          setAgentTools(opts.overrides.tools || [])

          const agentEnvPairs: TKeyValuePair[] = Object.entries(
            opts.overrides.envVars || {}
          ).map(([key, value]: [string, string], index) => ({
            id: `agent-env-${index}-${Date.now()}`,
            key,
            value,
          }))
          setAgentEnvVars(agentEnvPairs)

          setAgentSecrets(opts.overrides.secrets || [])
        } else {
          setAgentSystemPrompt(``)
          setAgentModel(``)
          setAgentMaxTokens(``)
          setAgentTools([])
          setAgentEnvVars([])
          setAgentSecrets([])
        }
      } else {
        setAgentId(``)
        setAgentSystemPrompt(``)
        setAgentModel(``)
        setAgentMaxTokens(``)
        setAgentTools([])
        setAgentEnvVars([])
        setAgentSecrets([])
      }

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
      setEPTimeout(opts.timeout?.toString() || ``)
      setRetries(opts.retries?.toString() || ``)
      setPathRegex(opts.pathRegex || ``)
      setRetryDelay(opts.retryDelay?.toString() || ``)
      setRetryMaxDelay(opts.retryMaxDelay?.toString() || ``)
      setRetryBackoffMultiplier(opts.retryBackoffMultiplier?.toString() || ``)
      setRetryExponentialBackoff(opts.retryExponentialBackoff !== false)

      if (opts.auth) {
        setAuthEnabled(true)
        setAuthType(opts.auth.type || `bearer`)
        setAuthSecretName(opts.auth.secretName || ``)
        setAuthHeaderName(opts.auth.headerName || ``)
      } else {
        setAuthEnabled(false)
        setAuthType(`bearer`)
        setAuthSecretName(``)
        setAuthHeaderName(``)
      }

      if (opts.oauth) {
        setOauthEnabled(true)
        setOauthTokenUrl(opts.oauth.tokenUrl || ``)
        setOauthClientId(opts.oauth.clientId || ``)
        setOauthClientSecret(opts.oauth.clientSecret || ``)
        setOauthScopes(opts.oauth.scopes?.join(`, `) || ``)
        setOauthCredentialStyle(opts.oauth.credentialStyle || `header`)

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
        setOauthTokenUrl(``)
        setOauthClientId(``)
        setOauthClientSecret(``)
        setOauthScopes(``)
        setOauthCredentialStyle(`header`)
        setOauthParams([])
      }

      if (opts.domainWhitelist) {
        setWhitelistEnabled(true)
        setWhitelistDomains(opts.domainWhitelist.allowedDomains?.join(`, `) || ``)
        setWhitelistEnforce(opts.domainWhitelist.enforceWhitelist !== false)
        setWhitelistLogBlocked(opts.domainWhitelist.logBlocked !== false)
      } else {
        setWhitelistEnabled(false)
        setWhitelistDomains(``)
        setWhitelistEnforce(true)
        setWhitelistLogBlocked(true)
      }
    } else {
      // Reset all fields
      setUrl(``)
      setName(``)
      setPath(``)
      setError(null)
      setMethod(`get`)
      setEndpointType(EEndpointType.proxy)
      setPublicEndpoint(false)
      setShowDeleteConfirm(false)
      setHeaderPairs([])
      setEPTimeout(``)
      setRetries(``)
      setPathRegex(``)
      setRetryDelay(``)
      setRetryMaxDelay(``)
      setRetryBackoffMultiplier(``)
      setRetryExponentialBackoff(true)
      setAuthEnabled(false)
      setAuthType(`bearer`)
      setAuthSecretName(``)
      setAuthHeaderName(``)
      setOauthEnabled(false)
      setOauthTokenUrl(``)
      setOauthClientId(``)
      setOauthClientSecret(``)
      setOauthScopes(``)
      setOauthCredentialStyle(`header`)
      setOauthParams([])
      setTransformEnabled(false)
      setTransformInjectSecrets(false)
      setWhitelistEnabled(false)
      setWhitelistDomains(``)
      setWhitelistEnforce(true)
      setWhitelistLogBlocked(true)

      // Reset FAAS fields
      setFunctionId(``)
      setFaasArguments([])
      setFaasEnvVars([])
      setFaasSecrets([])
      setFaasTimeout(``)
      setFaasMemory(``)

      // Reset Agent fields
      setAgentId(``)
      setAgentSystemPrompt(``)
      setAgentModel(``)
      setAgentMaxTokens(``)
      setAgentTools([])
      setAgentEnvVars([])
      setAgentSecrets([])
    }
  }, [endpoint])

  const onClose = () => {
    if (!loading) {
      setUrl(``)
      setName(``)
      setPath(``)
      setError(null)
      setMethod(`get`)
      setPublicEndpoint(false)
      setShowDeleteConfirm(false)
      setEndpointType(EEndpointType.proxy)
      setHeaderPairs([])
      setEPTimeout(``)
      setRetries(``)
      setPathRegex(``)
      setRetryDelay(``)
      setRetryMaxDelay(``)
      setRetryBackoffMultiplier(``)
      setRetryExponentialBackoff(true)
      setAuthEnabled(false)
      setAuthType(`bearer`)
      setAuthSecretName(``)
      setAuthHeaderName(``)
      setOauthEnabled(false)
      setOauthTokenUrl(``)
      setOauthClientId(``)
      setOauthClientSecret(``)
      setOauthScopes(``)
      setOauthCredentialStyle(`header`)
      setOauthParams([])
      setTransformEnabled(false)
      setTransformInjectSecrets(false)
      setWhitelistEnabled(false)
      setWhitelistDomains(``)
      setWhitelistEnforce(true)
      setWhitelistLogBlocked(true)
      setFunctionId(``)
      setFaasArguments([])
      setFaasEnvVars([])
      setFaasSecrets([])
      setFaasTimeout(``)
      setFaasMemory(``)
      setAgentId(``)
      setAgentSystemPrompt(``)
      setAgentModel(``)
      setAgentMaxTokens(``)
      setAgentTools([])
      setAgentEnvVars([])
      setAgentSecrets([])
      onCloseCB?.()
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) return setError(`Endpoint name is required`)

    if (!path.trim()) return setError(`Endpoint path is required`)

    // Type-specific validation
    if (endpointType === EEndpointType.faas && !functionId)
      return setError(`Please select a function for FAAS endpoints`)

    if (endpointType === EEndpointType.agent && !agentId)
      return setError(`Please select an agent for agent endpoints`)

    if (endpointType === EEndpointType.proxy && !url.trim())
      return setError(`Proxy URL is required for proxy endpoints`)

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
    const options = { type: endpointType } as TEndpointOpts<TEndpointType>

    // Type-specific configurations
    if (endpointType === EEndpointType.proxy) {
      if (transformEnabled) {
        Object.assign(options, {
          transform: {
            injectSecrets: transformInjectSecrets,
          },
        })
      }
    } else if (endpointType === EEndpointType.faas) {
      const faasArgs: Record<string, any> = {}
      faasArguments.forEach((pair) => {
        if (pair.key.trim() && pair.value.trim()) {
          try {
            faasArgs[pair.key.trim()] = JSON.parse(pair.value.trim())
          } catch {
            faasArgs[pair.key.trim()] = pair.value.trim()
          }
        }
      })

      const faasEnv: Record<string, string> = {}
      faasEnvVars.forEach((pair) => {
        if (pair.key.trim() && pair.value.trim()) {
          faasEnv[pair.key.trim()] = pair.value.trim()
        }
      })

      Object.assign(options, {
        functionId: functionId,
        secrets: faasSecrets.length > 0 ? faasSecrets : undefined,
        envVars: Object.keys(faasEnv).length > 0 ? faasEnv : undefined,
        memory: faasMemory ? Number.parseInt(faasMemory, 10) : undefined,
        arguments: Object.keys(faasArgs).length > 0 ? faasArgs : undefined,
        timeout: faasTimeout ? Number.parseInt(faasTimeout, 10) : undefined,
      })
    } else if (endpointType === EEndpointType.agent) {
      const agentEnv: Record<string, string> = {}
      agentEnvVars.forEach((pair) => {
        if (pair.key.trim() && pair.value.trim()) {
          agentEnv[pair.key.trim()] = pair.value.trim()
        }
      })

      Object.assign(options, {
        agentId: agentId,
        overrides: {
          systemPrompt: agentSystemPrompt || undefined,
          model: agentModel || undefined,
          maxTokens: agentMaxTokens ? Number.parseInt(agentMaxTokens, 10) : undefined,
          tools: agentTools.length > 0 ? agentTools : undefined,
          envVars: Object.keys(agentEnv).length > 0 ? agentEnv : undefined,
          secrets: agentSecrets.length > 0 ? agentSecrets : undefined,
        },
      })
    }

    // General proxy configuration
    if (timeout) options.timeout = Number.parseInt(timeout, 10)
    if (retries) options.retries = Number.parseInt(retries, 10)
    if (pathRegex) options.pathRegex = pathRegex

    if (retryDelay) options.retryDelay = Number.parseInt(retryDelay, 10)
    if (retryMaxDelay) options.retryMaxDelay = Number.parseInt(retryMaxDelay, 10)
    if (retryBackoffMultiplier)
      options.retryBackoffMultiplier = Number.parseFloat(retryBackoffMultiplier)
    if (retries) options.retryExponentialBackoff = retryExponentialBackoff

    if (authEnabled) {
      options.auth = {
        type: authType,
        secretName: authSecretName || undefined,
        headerName: authHeaderName || undefined,
      }
    }

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
            url: url.trim(),
            name: name.trim(),
            path: path.trim(),
            public: publicEndpoint,
            type: endpointType,
          })
        : await createEndpoint({
            method,
            headers,
            options,
            projectId,
            url: url.trim(),
            name: name.trim(),
            path: path.trim(),
            public: publicEndpoint,
            type: endpointType,
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
    <Drawer
      open={open}
      onClose={onClose}
      title={isEditMode ? 'Edit Endpoint' : 'Create New Endpoint'}
      actionsSx={
        isEditMode ? { justifyContent: 'space-between', px: 3, pb: 2 } : undefined
      }
      actions={
        <>
          <Box
            sx={{
              gap: 1,
              display: 'flex',
            }}
          >
            {isEditMode && (
              <Button
                color='error'
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading || showDeleteConfirm}
              >
                Delete
              </Button>
            )}
            <Button
              color='warning'
              variant='outlined'
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
          </Box>
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
        </>
      }
    >
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
            <ConfirmDelete
              itemName={name}
              deleting={loading}
              onConfirm={onDelete}
              warnText='This action can not be undone!'
              onCancel={() => setShowDeleteConfirm(false)}
            />
          )}

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

            <SelectInput
              required
              id='endpoint-type'
              label='Endpoint Type'
              value={endpointType}
              items={EndpointTypeOpts}
              disabled={loading || isEditMode}
              onChange={(e) => setEndpointType(e.target.value as TEndpointType)}
            />

            <TextInput
              required
              fullWidth
              value={path}
              id='endpoint-path'
              disabled={loading}
              label='Endpoint Path'
              placeholder='/custom/path'
              onChange={(e) => setPath(e.target.value)}
            />

            {/* Type-specific configuration */}
            {endpointType === EEndpointType.proxy && (
              <EndpointProxy
                loading={loading}
                url={url}
                method={method}
                timeout={timeout}
                retries={retries}
                authType={authType}
                onUrlChange={setUrl}
                pathRegex={pathRegex}
                headers={headerPairs}
                retryDelay={retryDelay}
                oauthScopes={oauthScopes}
                oauthParams={oauthParams}
                authEnabled={authEnabled}
                onMethodChange={setMethod}
                oauthEnabled={oauthEnabled}
                onRetriesChange={setRetries}
                oauthTokenUrl={oauthTokenUrl}
                oauthClientId={oauthClientId}
                retryMaxDelay={retryMaxDelay}
                onTimeoutChange={setEPTimeout}
                onAuthTypeChange={setAuthType}
                authSecretName={authSecretName}
                authHeaderName={authHeaderName}
                onHeadersChange={setHeaderPairs}
                onPathRegexChange={setPathRegex}
                onRetryDelayChange={setRetryDelay}
                whitelistEnabled={whitelistEnabled}
                whitelistDomains={whitelistDomains}
                whitelistEnforce={whitelistEnforce}
                availableSecrets={availableSecrets}
                transformEnabled={transformEnabled}
                onOauthParamsChange={setOauthParams}
                onOauthScopesChange={setOauthScopes}
                onAuthEnabledChange={setAuthEnabled}
                oauthClientSecret={oauthClientSecret}
                onOauthEnabledChange={setOauthEnabled}
                onOauthTokenUrlChange={setOauthTokenUrl}
                onOauthClientIdChange={setOauthClientId}
                onRetryMaxDelayChange={setRetryMaxDelay}
                whitelistLogBlocked={whitelistLogBlocked}
                onAuthSecretNameChange={setAuthSecretName}
                onAuthHeaderNameChange={setAuthHeaderName}
                oauthCredentialStyle={oauthCredentialStyle}
                onWhitelistEnabledChange={setWhitelistEnabled}
                onWhitelistDomainsChange={setWhitelistDomains}
                onWhitelistEnforceChange={setWhitelistEnforce}
                onTransformEnabledChange={setTransformEnabled}
                transformInjectSecrets={transformInjectSecrets}
                retryBackoffMultiplier={retryBackoffMultiplier}
                onOauthClientSecretChange={setOauthClientSecret}
                retryExponentialBackoff={retryExponentialBackoff}
                onWhitelistLogBlockedChange={setWhitelistLogBlocked}
                onOauthCredentialStyleChange={setOauthCredentialStyle}
                onTransformInjectSecretsChange={setTransformInjectSecrets}
                onRetryBackoffMultiplierChange={setRetryBackoffMultiplier}
                onRetryExponentialBackoffChange={setRetryExponentialBackoff}
              />
            )}

            {endpointType === EEndpointType.faas && (
              <EndpointFaas
                loading={loading}
                memory={faasMemory}
                timeout={faasTimeout}
                envVars={faasEnvVars}
                secrets={faasSecrets}
                functionId={functionId}
                arguments={faasArguments}
                onMemoryChange={setFaasMemory}
                onEnvVarsChange={setFaasEnvVars}
                onSecretsChange={setFaasSecrets}
                onTimeoutChange={setFaasTimeout}
                onFunctionIdChange={setFunctionId}
                availableSecrets={availableSecrets}
                onArgumentsChange={setFaasArguments}
                availableFunctions={availableFunctions}
              />
            )}

            {endpointType === EEndpointType.agent && (
              <EndpointAgent
                loading={loading}
                agentId={agentId}
                model={agentModel}
                tools={agentTools}
                envVars={agentEnvVars}
                secrets={agentSecrets}
                maxTokens={agentMaxTokens}
                onAgentIdChange={setAgentId}
                onModelChange={setAgentModel}
                onToolsChange={setAgentTools}
                systemPrompt={agentSystemPrompt}
                onEnvVarsChange={setAgentEnvVars}
                onSecretsChange={setAgentSecrets}
                availableSecrets={availableSecrets}
                onMaxTokensChange={setAgentMaxTokens}
                onSystemPromptChange={setAgentSystemPrompt}
              />
            )}

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
        </Box>
      </form>
    </Drawer>
  )
}
