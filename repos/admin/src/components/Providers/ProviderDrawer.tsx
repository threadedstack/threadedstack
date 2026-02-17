import type { Provider, Secret, TProviderType } from '@tdsk/domain'
import type { TKeyValuePair } from '@TAF/types'

import { secretsApi } from '@TAF/services'
import { useProviders } from '@TAF/state/selectors'
import { ProviderTypes } from '@TAF/constants/providers'
import { kvToObj, objToKV } from '@TAF/utils/transforms/kvs'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { createSecret } from '@TAF/actions/secrets/api/createSecret'
import { createProvider, updateProvider } from '@TAF/actions/providers'
import { ELLMProvider, EProvider, ProviderTemplates } from '@tdsk/domain'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { Drawer, TextInput, SelectInput, DrawerActions } from '@tdsk/components'
import {
  ExpandMore as ExpandMoreIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material'
import {
  Box,
  Chip,
  Alert,
  Accordion,
  Typography,
  IconButton,
  InputAdornment,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

const LLMProviderOptions = Object.values(ELLMProvider).map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}))

type TSecretMode = 'none' | 'existing' | 'new'

const SecretModeOptions = [
  { value: 'none', label: 'None' },
  { value: 'existing', label: 'Select Existing' },
  { value: 'new', label: 'Create New' },
]

export type TProviderDrawer = {
  open: boolean
  orgId: string
  provider?: Provider | null
  onClose: () => void
  onSuccess?: () => void
  onRemove?: (provider: Provider) => void
}

export const ProviderDrawer = ({
  open,
  orgId,
  provider,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
  onRemove,
}: TProviderDrawer) => {
  const isEditMode = Boolean(provider)
  const [providers] = useProviders()

  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [llmProvider, setLlmProvider] = useState('')
  const [headers, setHeaders] = useState<TKeyValuePair[]>([])
  const [bodyParams, setBodyParams] = useState<TKeyValuePair[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Secret management
  const [secretMode, setSecretMode] = useState<TSecretMode>('none')
  const [apiKeyValue, setApiKeyValue] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [selectedSecretId, setSelectedSecretId] = useState('')
  const [orgSecrets, setOrgSecrets] = useState<Secret[]>([])

  const isAiType = type === EProvider.ai
  const template = isAiType && llmProvider ? ProviderTemplates[llmProvider] : undefined

  const duplicateName = useMemo(() => {
    if (isEditMode || !name.trim() || !providers) return false
    const trimmed = name.trim().toLowerCase()
    return Object.values(providers).some((p) => p.name?.toLowerCase() === trimmed)
  }, [name, providers, isEditMode])

  // Provider-linked secrets (fetched by providerId in edit mode)
  const [providerSecrets, setProviderSecrets] = useState<Secret[]>([])

  const secretOptions = orgSecrets.map((s) => ({
    value: s.name || s.hashKey || s.id,
    label: s.name || s.hashKey || s.id,
  }))

  // Load org secrets for the select dropdown and headers autocomplete
  const loadSecrets = useCallback(async () => {
    if (!orgId) return

    const resp = await secretsApi.list(orgId)
    if (resp.data) setOrgSecrets(resp.data)
  }, [orgId])

  // Load provider-linked secrets in edit mode
  const loadProviderSecrets = useCallback(async () => {
    if (!orgId || !provider?.id) return

    const resp = await secretsApi.list(orgId, undefined, { providerId: provider.id })
    if (resp.data) setProviderSecrets(resp.data)
  }, [orgId, provider?.id])

  useEffect(() => {
    if (!open) return

    loadSecrets()
    if (isEditMode) loadProviderSecrets()
  }, [open, loadSecrets, isEditMode, loadProviderSecrets])

  // Pre-populate form
  useEffect(() => {
    if (provider) {
      const options = provider.options || {}
      setName(provider.name || '')
      setType(provider.type || '')
      setBaseUrl(options.baseUrl || '')
      setLlmProvider(options.llmProvider || '')
      setHeaders(objToKV(provider.headers, 'header'))
      setBodyParams(objToKV(provider.bodyParams, 'bodyParam'))
      setError(null)
      setSecretMode('none')
      setApiKeyValue('')
      setShowApiKey(false)
      setSelectedSecretId('')
    } else {
      setName('')
      setType('')
      setBaseUrl('')
      setLlmProvider('')
      setHeaders([])
      setBodyParams([])
      setError(null)
      setSecretMode('none')
      setApiKeyValue('')
      setShowApiKey(false)
      setSelectedSecretId('')
      setProviderSecrets([])
    }
  }, [provider])

  // Auto-fill from template when LLM provider changes (create mode only)
  useEffect(() => {
    if (isEditMode || !isAiType || !llmProvider) return

    const tpl = ProviderTemplates[llmProvider]
    if (!tpl) return

    setName(tpl.name)
    if (tpl.baseUrl) setBaseUrl(tpl.baseUrl)
  }, [llmProvider, isAiType, isEditMode])

  const onClose = () => {
    if (loading) return

    setName('')
    setType('')
    setBaseUrl('')
    setLlmProvider('')
    setHeaders([])
    setBodyParams([])
    setError(null)
    setSecretMode('none')
    setApiKeyValue('')
    setShowApiKey(false)
    setSelectedSecretId('')
    setProviderSecrets([])
    onCloseCB?.()
  }

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!name.trim()) return setError('Provider name is required')
    if (!type) return setError('Provider type is required')
    if (isAiType && !llmProvider)
      return setError('LLM provider is required for AI providers')
    if (secretMode === 'new' && !apiKeyValue.trim())
      return setError('API key value is required')

    setLoading(true)
    setError(null)

    const providerType = type as TProviderType
    const headersObj = kvToObj(headers, false)
    const bodyParamsObj = kvToObj(bodyParams, true)
    const providerData: Partial<Provider> = {
      name: name.trim(),
      type: providerType,
      options: {
        ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
        ...(isAiType && llmProvider ? { llmProvider } : {}),
      },
      ...(Object.keys(headersObj).length > 0
        ? { headers: headersObj }
        : { headers: undefined }),
      ...(Object.keys(bodyParamsObj).length > 0
        ? { bodyParams: bodyParamsObj }
        : { bodyParams: undefined }),
    }

    const result =
      isEditMode && provider
        ? await updateProvider({ orgId, id: provider.id, data: providerData })
        : await createProvider({ orgId, data: providerData })

    if (result.error) {
      setLoading(false)
      return setError(
        `Failed to ${isEditMode ? 'update' : 'create'} provider. Please try again.`
      )
    }

    // Create secret with dual ownership (orgId + providerId) if "new" mode
    if (secretMode === 'new' && apiKeyValue.trim()) {
      const secretName =
        template?.defaultSecretName ||
        `${name.trim().toUpperCase().replace(/\s+/g, '_')}_API_KEY`
      const providerId = isEditMode ? provider?.id : result.provider?.id
      const secretResult = await createSecret({
        orgId,
        name: secretName,
        value: apiKeyValue.trim(),
        ...(providerId ? { providerId } : {}),
      })
      if (secretResult.error) {
        setLoading(false)
        return setError(
          `Provider saved, but failed to create API key secret: ${secretResult.error.message}`
        )
      }
    }

    setLoading(false)
    onSuccessCB?.()
    onClose()
  }

  const { actions } = useDrawerActions({
    onSave,
    onClose,
    onRemove: provider ? () => onRemove?.(provider) : undefined,
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEditMode ? 'Edit Provider' : 'Create New Provider'}
      actions={
        <DrawerActions
          form='provider-form'
          editing={isEditMode}
          actions={actions}
          loading={loading}
          disabled={loading}
        />
      }
    >
      <form id='provider-form'>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && (
            <ErrorAlert
              message={error}
              onClose={() => setError(null)}
            />
          )}

          <SelectInput
            id='provider-type'
            label='Provider Type'
            value={type}
            onChange={(e) => {
              setType(e.target.value)
              if (e.target.value !== EProvider.ai) {
                setLlmProvider('')
              }
            }}
            items={ProviderTypes}
            required
            disabled={loading}
          />

          {isAiType && (
            <SelectInput
              required
              disabled={loading}
              value={llmProvider}
              label='LLM Provider'
              id='provider-llm-provider'
              items={LLMProviderOptions}
              onChange={(e) => setLlmProvider(e.target.value)}
              description='The AI service this provider connects to'
            />
          )}

          <TextInput
            id='provider-name'
            label='Provider Name'
            placeholder='Enter provider name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            disabled={loading}
          />

          {duplicateName && (
            <Alert severity='warning'>
              A provider with this name already exists. Creating another will result in
              duplicates.
            </Alert>
          )}

          <TextInput
            id='provider-base-url'
            label='Base URL'
            placeholder={template?.baseUrl || 'https://api.example.com (optional)'}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            fullWidth
            disabled={loading}
          />

          {/* API Key Secret section */}
          {isAiType && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant='subtitle2'>API Key Secret</Typography>

              {/* Show provider-linked secrets */}
              {isEditMode && providerSecrets.length > 0 && (
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
                  {providerSecrets.map((s) => (
                    <Chip
                      key={s.id}
                      label={s.name}
                      size='small'
                      variant='outlined'
                      color='primary'
                    />
                  ))}
                </Box>
              )}

              <SelectInput
                id='provider-secret-mode'
                label={isEditMode ? 'Change API Key' : 'API Key'}
                value={secretMode}
                items={SecretModeOptions}
                onChange={(e) => {
                  setSecretMode(e.target.value as TSecretMode)
                  setApiKeyValue('')
                  setSelectedSecretId('')
                  setShowApiKey(false)
                }}
                disabled={loading}
              />

              {secretMode === 'existing' && (
                <SelectInput
                  id='provider-existing-secret'
                  label='Select Secret'
                  value={selectedSecretId}
                  items={secretOptions}
                  onChange={(e) => setSelectedSecretId(e.target.value)}
                  disabled={loading}
                  description='Choose an existing org-scoped secret'
                />
              )}

              {secretMode === 'new' && (
                <TextInput
                  id='provider-api-key-value'
                  label='API Key Value'
                  placeholder={template?.apiKeyPlaceholder || 'Enter your API key...'}
                  value={apiKeyValue}
                  onChange={(e) => setApiKeyValue(e.target.value)}
                  fullWidth
                  required
                  disabled={loading}
                  type={showApiKey ? 'text' : 'password'}
                  endAdornment={
                    <InputAdornment position='end'>
                      <IconButton
                        edge='end'
                        disabled={loading}
                        onClick={() => setShowApiKey((prev) => !prev)}
                        aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                      >
                        {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  }
                />
              )}
            </Box>
          )}

          {/* Custom Headers */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                variant='subtitle1'
                fontWeight={500}
              >
                Headers
              </Typography>
              {headers.length > 0 && (
                <Chip
                  size='small'
                  label={headers.length}
                  sx={{ ml: 1 }}
                />
              )}
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <KeyValueEditor
                  pairs={headers}
                  disabled={loading}
                  secrets={orgSecrets}
                  keyPlaceholder='Header Name'
                  valuePlaceholder='Header Value or {{secret-name}}'
                  enableSecretReferences={true}
                  onChange={setHeaders}
                />
                <Alert
                  severity='info'
                  sx={{ fontSize: '0.875rem' }}
                >
                  Custom headers included in provider API requests. Use {'{{'} and {'}}'}{' '}
                  to reference secrets.
                </Alert>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Body Parameters */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                variant='subtitle1'
                fontWeight={500}
              >
                Body Parameters
              </Typography>
              {bodyParams.length > 0 && (
                <Chip
                  size='small'
                  label={bodyParams.length}
                  sx={{ ml: 1 }}
                />
              )}
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <KeyValueEditor
                  pairs={bodyParams}
                  disabled={loading}
                  secrets={orgSecrets}
                  keyPlaceholder='Parameter Name'
                  valuePlaceholder='Value (supports JSON: numbers, booleans, objects)'
                  enableSecretReferences={true}
                  onChange={setBodyParams}
                />
                <Alert
                  severity='info'
                  sx={{ fontSize: '0.875rem' }}
                >
                  Extra parameters added to the LLM request body. Values are parsed as
                  JSON (numbers, booleans, objects). Use {'{{'} and {'}}'} to reference
                  secrets.
                </Alert>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>
      </form>
    </Drawer>
  )
}
