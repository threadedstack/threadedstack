import type { TKeyValuePair } from '@TAF/types'
import type {
  Secret,
  Provider,
  TSecretMode,
  TProviderType,
  TProviderBrand,
  TLLMProviderBrand,
} from '@tdsk/domain'

import { ESecretMode } from '@tdsk/domain'
import { useProviders } from '@TAF/state/selectors'
import { ProviderTypes } from '@TAF/constants/providers'
import { SecretModeOptions } from '@TAF/constants/values'
import { kvToObj, objToKV } from '@TAF/utils/transforms/kvs'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { createSecret } from '@TAF/actions/secrets/api/createSecret'
import { fetchSecrets } from '@TAF/actions/secrets/api/fetchSecrets'
import { createProvider, updateProvider } from '@TAF/actions/providers'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { ELLMProviderBrand, EProvider, ProviderTemplates } from '@tdsk/domain'
import { Drawer, TextInput, SelectInput, DrawerActions } from '@tdsk/components'
import { fetchProviderSecrets } from '@TAF/actions/secrets/api/fetchProviderSecrets'
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

const LLMProviderOptions = Object.values(ELLMProviderBrand).map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}))

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
  onRemove,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TProviderDrawer) => {
  const isEditMode = Boolean(provider)
  const [providers] = useProviders()

  const [name, setName] = useState(``)
  const [type, setType] = useState(``)
  const [baseUrl, setBaseUrl] = useState(``)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [brand, setBrand] = useState<TProviderBrand | ''>(``)
  const [headers, setHeaders] = useState<TKeyValuePair[]>([])
  const [bodyParams, setBodyParams] = useState<TKeyValuePair[]>([])

  // Secret management
  const [secretMode, setSecretMode] = useState<TSecretMode>(ESecretMode.none)
  const [apiKeyValue, setApiKeyValue] = useState(``)
  const [showApiKey, setShowApiKey] = useState(false)
  const [selectedSecretId, setSelectedSecretId] = useState(``)
  const [orgSecrets, setOrgSecrets] = useState<Secret[]>([])

  const isAiType = type === EProvider.ai
  const template = isAiType && brand ? ProviderTemplates[brand] : undefined

  const duplicateName = useMemo(() => {
    if (isEditMode || !name.trim() || !providers) return false
    const trimmed = name.trim().toLowerCase()
    return Object.values(providers).some((p) => p.name?.toLowerCase() === trimmed)
  }, [name, providers, isEditMode])

  // Provider-linked secrets (fetched by providerId in edit mode)
  const [providerSecrets, setProviderSecrets] = useState<Secret[]>([])

  const secretOptions = orgSecrets.map((s) => ({
    value: s.id,
    label: s.name || s.hashKey || s.id,
  }))

  // Load org secrets for the select dropdown and headers autocomplete
  const loadSecrets = useCallback(async () => {
    if (!orgId) return

    const resp = await fetchSecrets({ orgId })
    if (resp.error) {
      setError(`Failed to load org secrets`)
      console.warn(`[ProviderDrawer] Failed to load org secrets:`, resp.error)
    }
    resp.data && setOrgSecrets(resp.data)
  }, [orgId])

  // Load provider-linked secrets in edit mode
  const loadProviderSecrets = useCallback(async () => {
    if (!orgId || !provider?.id) return

    const resp = await fetchProviderSecrets({ orgId, providerId: provider.id })
    if (resp.error) {
      setError(`Failed to load provider secrets`)
      console.warn(`[ProviderDrawer] Failed to load provider secrets:`, resp.error)
    }
    resp.data && setProviderSecrets(resp.data)
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
      setName(provider.name || ``)
      setType(provider.type || ``)
      setBaseUrl(options.baseUrl || ``)
      setBrand(provider.brand || ``)
      setHeaders(objToKV(provider.headers, `header`))
      setBodyParams(objToKV(provider.bodyParams, `bodyParam`))
      setError(null)
      setApiKeyValue(``)
      setShowApiKey(false)

      // Pre-select the linked API key secret
      if (provider.secretId) {
        setSelectedSecretId(provider.secretId)
        setSecretMode(ESecretMode.existing)
      } else {
        setSelectedSecretId(``)
        setSecretMode(ESecretMode.none)
      }
    } else {
      setName(``)
      setType(``)
      setBaseUrl(``)
      setBrand(``)
      setHeaders([])
      setBodyParams([])
      setError(null)
      setApiKeyValue(``)
      setShowApiKey(false)
      setSelectedSecretId(``)
      setProviderSecrets([])
      setSecretMode(ESecretMode.none)
    }
  }, [provider])

  // Auto-fill from template when LLM provider changes (create mode only)
  useEffect(() => {
    if (isEditMode || !isAiType || !brand) return

    const tpl = ProviderTemplates[brand]
    if (!tpl) return

    setName(tpl.name)
    if (tpl.baseUrl) setBaseUrl(tpl.baseUrl)
  }, [brand, isAiType, isEditMode])

  const onClose = () => {
    if (loading) return

    setName(``)
    setType(``)
    setBaseUrl(``)
    setBrand(``)
    setHeaders([])
    setBodyParams([])
    setError(null)
    setApiKeyValue(``)
    setShowApiKey(false)
    setSelectedSecretId(``)
    setProviderSecrets([])
    onCloseCB?.()
    setSecretMode(ESecretMode.none)
  }

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!name.trim()) return setError(`Provider name is required`)
    if (!type) return setError(`Provider type is required`)
    if (isAiType && !brand) return setError(`LLM provider is required for AI providers`)
    if (secretMode === ESecretMode.new && !apiKeyValue.trim())
      return setError(`API key value is required`)

    setLoading(true)
    setError(null)

    const headersObj = kvToObj(headers, false)
    const bodyParamsObj = kvToObj(bodyParams, true)
    const providerData: Partial<Provider> = {
      name: name.trim(),
      type: type as TProviderType,
      ...(isAiType && brand ? { brand } : {}),
      options: {
        ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
      },
      ...(Object.keys(headersObj).length > 0
        ? { headers: headersObj }
        : { headers: undefined }),
      ...(Object.keys(bodyParamsObj).length > 0
        ? { bodyParams: bodyParamsObj }
        : { bodyParams: undefined }),
      // Link existing secret as the API key
      ...(secretMode === 'existing' && selectedSecretId
        ? { secretId: selectedSecretId }
        : {}),
    }

    const result =
      isEditMode && provider
        ? await updateProvider({ orgId, id: provider.id, data: providerData })
        : await createProvider({ orgId, data: providerData })

    if (result.error) {
      setLoading(false)
      return setError(
        `Failed to ${isEditMode ? `update` : `create`} provider. Please try again.`
      )
    }

    // Create secret with dual ownership (orgId + providerId) if "new" mode
    if (secretMode === `new` && apiKeyValue.trim()) {
      const secretName =
        template?.defaultSecretName ||
        `${name.trim().toUpperCase().replace(/\s+/g, '_')}_API_KEY`
      const providerId = isEditMode ? provider?.id : result.data?.id
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

      // Link the new secret as the provider's API key
      if (secretResult.data?.id && providerId) {
        const linkResult = await updateProvider({
          orgId,
          id: providerId,
          data: { secretId: secretResult.data.id },
        })
        if (linkResult.error) {
          setLoading(false)
          return setError(
            `Provider and API key saved, but failed to link them. Please edit the provider to select the secret manually.`
          )
        }
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
            items={ProviderTypes}
            required
            disabled={loading}
            onChange={(e) => {
              setType(e.target.value)
              e.target.value !== EProvider.ai && setBrand(``)
            }}
          />

          {isAiType && (
            <SelectInput
              required
              value={brand}
              label='Provider'
              disabled={loading}
              id='provider-brand'
              items={LLMProviderOptions}
              description='The AI service this provider connects to'
              onChange={(e) => setBrand(e.target.value as TLLMProviderBrand)}
            />
          )}

          <TextInput
            required
            fullWidth
            value={name}
            id='provider-name'
            disabled={loading}
            label='Provider Name'
            placeholder='Enter provider name'
            onChange={(e) => setName(e.target.value)}
          />

          {duplicateName && (
            <Alert severity='warning'>
              A provider with this name already exists. Creating another will result in
              duplicates.
            </Alert>
          )}

          <TextInput
            fullWidth
            value={baseUrl}
            label='Base URL'
            disabled={loading}
            id='provider-base-url'
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={template?.baseUrl || 'https://api.example.com (optional)'}
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
                      size='small'
                      variant='outlined'
                      color={provider?.secretId === s.id ? 'success' : 'primary'}
                      label={provider?.secretId === s.id ? `${s.name} (API Key)` : s.name}
                    />
                  ))}
                </Box>
              )}

              <SelectInput
                id='provider-secret-mode'
                value={secretMode}
                disabled={loading}
                items={SecretModeOptions}
                label={isEditMode ? 'Change API Key' : 'API Key'}
                onChange={(e) => {
                  setSecretMode(e.target.value as TSecretMode)
                  setApiKeyValue(``)
                  setSelectedSecretId(``)
                  setShowApiKey(false)
                }}
              />

              {secretMode === 'existing' && (
                <SelectInput
                  disabled={loading}
                  label='Select Secret'
                  items={secretOptions}
                  value={selectedSecretId}
                  id='provider-existing-secret'
                  description='Choose an existing org-scoped secret'
                  onChange={(e) => setSelectedSecretId(e.target.value)}
                />
              )}

              {secretMode === 'new' && (
                <TextInput
                  required
                  fullWidth
                  disabled={loading}
                  value={apiKeyValue}
                  label='API Key Value'
                  id='provider-api-key-value'
                  type={showApiKey ? 'text' : 'password'}
                  onChange={(e) => setApiKeyValue(e.target.value)}
                  placeholder={template?.apiKeyPlaceholder || 'Enter your API key...'}
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
