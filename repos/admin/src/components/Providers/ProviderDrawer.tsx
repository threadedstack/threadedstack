import type { TKeyValuePair } from '@TAF/types'
import type { EDockerProviderBrand } from '@tdsk/domain'
import type {
  Secret,
  Provider,
  TSecretMode,
  TProviderType,
  TProviderBrand,
  TAIProviderBrand,
} from '@tdsk/domain'

import { kvToObj, objToKV } from '@TAF/utils/transforms/kvs'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useProviders, useOrgSecrets } from '@TAF/state/selectors'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { createSecret } from '@TAF/actions/secrets/api/createSecret'
import { createProvider, updateProvider } from '@TAF/actions/providers'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { SecretSelector } from '@TAF/components/SecretSelector/SecretSelector'
import { Drawer, TextInput, SelectInput, DrawerActions } from '@tdsk/components'
import { fetchProviderSecrets } from '@TAF/actions/secrets/api/fetchProviderSecrets'
import {
  ProviderTypes,
  DockerProviderOptions,
  GitProviderOptions,
} from '@TAF/constants/providers'
import type { EGitProvider } from '@tdsk/domain'
import {
  EProvider,
  ESecretMode,
  EAIProviderBrand,
  AIProviderTemplates,
  GitProviderTemplates,
  ProviderBrandDomains,
  DockerRegistryDefaults,
} from '@tdsk/domain'
import {
  Box,
  Chip,
  Alert,
  Accordion,
  TextField,
  Typography,
  Autocomplete,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

const AIProviderOptions = Object.values(EAIProviderBrand).map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}))

export type TProviderDrawer = {
  open: boolean
  orgId: string
  onClose: () => void
  provider?: Provider | null
  defaultType?: TProviderType
  onSuccess?: (providerId?: string) => void
  onRemove?: (provider: Provider) => void
}

export const ProviderDrawer = (props: TProviderDrawer) => {
  const {
    open,
    orgId,
    provider,
    onRemove,
    defaultType,
    onClose: onCloseCB,
    onSuccess: onSuccessCB,
  } = props

  const isEditMode = Boolean(provider)
  const [providers] = useProviders()

  const [name, setName] = useState(``)
  const [type, setType] = useState(``)
  const domainsModified = useRef(false)
  const [baseUrl, setBaseUrl] = useState(``)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [brand, setBrand] = useState<TProviderBrand | ''>(``)
  const [headers, setHeaders] = useState<TKeyValuePair[]>([])
  const [bodyParams, setBodyParams] = useState<TKeyValuePair[]>([])
  const [allowedDomains, setAllowedDomains] = useState<string[]>([])

  // Secret management
  const [secretMode, setSecretMode] = useState<TSecretMode>(ESecretMode.none)
  const [apiKeyValue, setApiKeyValue] = useState(``)
  const [selectedSecretId, setSelectedSecretId] = useState(``)

  // Jotai state — replace local orgSecrets fetch
  const [orgSecretsMap] = useOrgSecrets()
  const orgSecrets = useMemo<Secret[]>(
    () => Object.values(orgSecretsMap || {}),
    [orgSecretsMap]
  )

  const [registry, setRegistry] = useState(``)
  const [username, setUsername] = useState(``)

  // Git-specific fields
  const [repoUrl, setRepoUrl] = useState(``)
  const [gitBranch, setGitBranch] = useState(`main`)

  const isAiType = type === EProvider.ai
  const isDockerType = type === EProvider.docker
  const isGitType = type === EProvider.git
  const template = isAiType && brand ? AIProviderTemplates[brand] : undefined
  const gitTemplate =
    isGitType && brand ? GitProviderTemplates[brand as EGitProvider] : undefined

  const duplicateName = useMemo(() => {
    if (isEditMode || !name.trim() || !providers) return false
    const trimmed = name.trim().toLowerCase()
    return Object.values(providers).some((p) => p.name?.toLowerCase() === trimmed)
  }, [name, providers, isEditMode])

  // Provider-linked secrets (fetched by providerId in edit mode)
  const [providerSecrets, setProviderSecrets] = useState<Secret[]>([])

  const secretOptions = useMemo(() => {
    const options = orgSecrets.map((s) => ({
      value: s.id,
      label: s.name || s.hashKey || s.id,
    }))
    if (
      provider?.secret &&
      provider.secretId &&
      !options.some((o) => o.value === provider.secretId)
    ) {
      options.unshift({
        value: provider.secretId,
        label: provider.secret.name || provider.secret.hashKey || provider.secretId,
      })
    }
    return options
  }, [orgSecrets, provider?.secret, provider?.secretId])

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

    if (isEditMode) loadProviderSecrets()
  }, [open, isEditMode, loadProviderSecrets])

  // Pre-populate form
  useEffect(() => {
    if (provider) {
      const options = provider.options || {}
      setName(provider.name || ``)
      setType(provider.type || ``)
      setBaseUrl(options.baseUrl || ``)
      setBrand(provider.brand || ``)
      setRegistry(options.registry || ``)
      setUsername(options.username || ``)
      setRepoUrl(options.repoUrl || ``)
      setGitBranch(options.branch || `main`)
      setHeaders(objToKV(provider.headers, `header`))
      setBodyParams(objToKV(provider.bodyParams, `bodyParam`))
      setAllowedDomains(options.allowedDomains || [])
      setError(null)
      setApiKeyValue(``)
      domainsModified.current = false

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
      setType(defaultType || ``)
      setBaseUrl(``)
      setBrand(``)
      setRegistry(``)
      setUsername(``)
      setRepoUrl(``)
      setGitBranch(`main`)
      setHeaders([])
      setBodyParams([])
      setError(null)
      setApiKeyValue(``)
      setAllowedDomains([])
      setProviderSecrets([])
      setSelectedSecretId(``)
      setSecretMode(ESecretMode.none)
      domainsModified.current = false
    }
  }, [provider, defaultType])

  // Auto-fill from template when LLM provider changes (create mode only)
  useEffect(() => {
    if (isEditMode || !isAiType || !brand) return

    const tpl = AIProviderTemplates[brand]
    if (!tpl) return

    setName(tpl.name)
    if (tpl.baseUrl) setBaseUrl(tpl.baseUrl)

    // Pre-fill allowed domains from brand defaults when user hasn't manually modified them
    if (!domainsModified.current) {
      const defaults = ProviderBrandDomains[brand]
      if (defaults?.length) setAllowedDomains(defaults)
    }
  }, [brand, isAiType, isEditMode])

  // Auto-fill registry when docker brand changes (create mode only)
  useEffect(() => {
    if (isEditMode || !isDockerType || !brand) return

    const dockerBrand = brand as EDockerProviderBrand
    const dockerDefaults = DockerRegistryDefaults[dockerBrand]
    if (dockerDefaults?.registry) setRegistry(dockerDefaults.registry)

    setName(dockerDefaults?.name || brand)
  }, [brand, isDockerType, isEditMode])

  // Auto-fill name when git brand changes (create mode only)
  useEffect(() => {
    if (isEditMode || !isGitType || !brand) return
    const tpl = GitProviderTemplates[brand as EGitProvider]
    if (!tpl) return
    setName(tpl.name)
  }, [brand, isGitType, isEditMode])

  const onClose = () => {
    if (loading) return

    setName(``)
    setType(defaultType || ``)
    setBaseUrl(``)
    setBrand(``)
    setRegistry(``)
    setUsername(``)
    setRepoUrl(``)
    setGitBranch(`main`)
    setHeaders([])
    setBodyParams([])
    setAllowedDomains([])
    setError(null)
    setApiKeyValue(``)
    setSelectedSecretId(``)
    setProviderSecrets([])
    domainsModified.current = false
    onCloseCB?.()
    setSecretMode(ESecretMode.none)
  }

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!name.trim()) return setError(`Provider name is required`)
    if (!type) return setError(`Provider type is required`)
    if (isAiType && !brand) return setError(`LLM provider is required for AI providers`)
    if (isDockerType && !brand)
      return setError(`Registry brand is required for Docker providers`)
    if (isGitType && !brand) return setError(`Git provider brand is required`)
    if (isGitType && !repoUrl.trim())
      return setError(`Repository URL is required for Git providers`)
    if (isDockerType && !registry.trim()) return setError(`Registry URL is required`)
    if (isDockerType && !username.trim()) return setError(`Username is required`)
    if (secretMode === ESecretMode.new && !apiKeyValue.trim())
      return setError(`Secret value is required`)

    setLoading(true)
    setError(null)

    const headersObj = kvToObj(headers, false)
    const bodyParamsObj = kvToObj(bodyParams, true)
    const providerData: Partial<Provider> = {
      name: name.trim(),
      type: type as TProviderType,
      ...((isAiType || isDockerType || isGitType) && brand ? { brand } : {}),
      options: {
        ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
        ...(allowedDomains.length > 0 ? { allowedDomains } : {}),
        ...(isDockerType && registry.trim() ? { registry: registry.trim() } : {}),
        ...(isDockerType && username.trim() ? { username: username.trim() } : {}),
        ...(isGitType && repoUrl.trim() ? { repoUrl: repoUrl.trim() } : {}),
        ...(isGitType ? { branch: gitBranch.trim() || `main` } : {}),
      },
      ...(!isDockerType && Object.keys(headersObj).length > 0
        ? { headers: headersObj }
        : { headers: undefined }),
      ...(!isDockerType && Object.keys(bodyParamsObj).length > 0
        ? { bodyParams: bodyParamsObj }
        : { bodyParams: undefined }),
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
      const secretName = isDockerType
        ? `${name.trim().toUpperCase().replace(/\s+/g, '_')}_REGISTRY_TOKEN`
        : isGitType
          ? gitTemplate?.defaultSecretName ||
            `${name.trim().toUpperCase().replace(/\s+/g, '_')}_GIT_TOKEN`
          : template?.defaultSecretName ||
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
    const createdId = isEditMode ? provider?.id : result.data?.id
    onSuccessCB?.(createdId)
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
          actions={actions}
          loading={loading}
          disabled={loading}
          form='provider-form'
          editing={isEditMode}
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
            required
            value={type}
            disabled={loading || (!!defaultType && !isEditMode)}
            id='provider-type'
            label='Provider Type'
            items={ProviderTypes}
            onChange={(e) => {
              setType(e.target.value)
              if (
                e.target.value !== EProvider.ai &&
                e.target.value !== EProvider.docker &&
                e.target.value !== EProvider.git
              )
                setBrand(``)
            }}
          />

          {isAiType && (
            <SelectInput
              required
              value={brand}
              label='Provider'
              disabled={loading}
              id='provider-brand'
              items={AIProviderOptions}
              description='The AI service this provider connects to'
              onChange={(e) => setBrand(e.target.value as TAIProviderBrand)}
            />
          )}

          {isDockerType && (
            <SelectInput
              required
              value={brand}
              label='Registry'
              disabled={loading}
              id='provider-docker-brand'
              items={DockerProviderOptions}
              description='The Docker registry this provider connects to'
              onChange={(e) => setBrand(e.target.value as EDockerProviderBrand)}
            />
          )}

          {isGitType && (
            <SelectInput
              required
              value={brand}
              label='Git Provider'
              disabled={loading}
              id='provider-git-brand'
              items={GitProviderOptions}
              description='The git hosting service this provider connects to'
              onChange={(e) => setBrand(e.target.value as EGitProvider)}
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

          {!isDockerType && !isGitType && (
            <TextInput
              fullWidth
              value={baseUrl}
              label='Base URL'
              disabled={loading}
              id='provider-base-url'
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={template?.baseUrl || 'https://api.example.com (optional)'}
            />
          )}

          {isDockerType && (
            <>
              <TextInput
                required
                fullWidth
                value={registry}
                label='Registry URL'
                disabled={loading}
                id='provider-registry'
                placeholder='e.g. ghcr.io'
                onChange={(e) => setRegistry(e.target.value)}
              />
              <TextInput
                required
                fullWidth
                value={username}
                label='Username'
                disabled={loading}
                id='provider-username'
                placeholder='Registry username or org name'
                onChange={(e) => setUsername(e.target.value)}
              />
            </>
          )}

          {isGitType && (
            <>
              <TextInput
                fullWidth
                value={repoUrl}
                label='Repository URL'
                disabled={loading}
                id='provider-repo-url'
                placeholder='https://github.com/org/repo.git'
                onChange={(e) => setRepoUrl(e.target.value)}
              />
              <TextInput
                fullWidth
                value={gitBranch}
                label='Branch'
                disabled={loading}
                id='provider-git-branch'
                placeholder='main'
                onChange={(e) => setGitBranch(e.target.value)}
              />
            </>
          )}

          {/* Secret section */}
          {(isAiType || isDockerType || isGitType) && (
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography
                  fontWeight={500}
                  variant='subtitle1'
                >
                  {isGitType
                    ? `Git Authentication`
                    : isDockerType
                      ? `Registry Authentication`
                      : `AI Provider Authentication`}
                </Typography>
              </AccordionSummary>

              <AccordionDetails>
                <SecretSelector
                  mode={secretMode}
                  disabled={loading}
                  editing={isEditMode}
                  label={
                    isGitType
                      ? `Auth Token`
                      : isDockerType
                        ? `Registry Token`
                        : `AI Provider Secret`
                  }
                  newSecretValue={apiKeyValue}
                  secretOptions={secretOptions}
                  linkedSecrets={providerSecrets}
                  onNewValueChange={setApiKeyValue}
                  activeSecretId={provider?.secretId}
                  selectedSecretId={selectedSecretId}
                  onSecretSelect={setSelectedSecretId}
                  editLabel={
                    isGitType
                      ? `Change Auth Token`
                      : isDockerType
                        ? `Change Registry Token`
                        : `Change AI Provider Secret`
                  }
                  valuePlaceholder={
                    isGitType
                      ? gitTemplate?.tokenPlaceholder || 'Enter git access token...'
                      : isDockerType
                        ? 'Enter registry password or access token...'
                        : template?.apiKeyPlaceholder ||
                          'Enter your AI Provider Secret...'
                  }
                  onModeChange={(mode) => {
                    setSecretMode(mode)
                    setApiKeyValue(``)
                    setSelectedSecretId(``)
                  }}
                />
              </AccordionDetails>
            </Accordion>
          )}

          {/* Allowed Domains (AI only) */}
          {!isDockerType && !isGitType && (
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography
                  variant='subtitle1'
                  fontWeight={500}
                >
                  Allowed Domains
                </Typography>
                {allowedDomains.length > 0 && (
                  <Chip
                    size='small'
                    label={allowedDomains.length}
                    sx={{ ml: 1 }}
                  />
                )}
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1 }}>
                  <Autocomplete
                    multiple
                    freeSolo
                    options={[]}
                    disabled={loading}
                    value={allowedDomains}
                    data-testid='tdsk-provider-allowed-domains'
                    onChange={(_evt, newValue) => {
                      const normalized = (newValue as string[])
                        .map((d) =>
                          d
                            .trim()
                            .replace(/^https?:\/\//, ``)
                            .split(`/`)[0]
                            .trim()
                        )
                        .filter(Boolean)
                      setAllowedDomains(normalized)
                      domainsModified.current = true
                    }}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => {
                        const { key, ...tagProps } = getTagProps({ index })
                        return (
                          <Chip
                            key={key}
                            size='small'
                            label={option}
                            {...tagProps}
                          />
                        )
                      })
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        variant='outlined'
                        label='Allowed Domains'
                        placeholder='Type a domain and press Enter'
                      />
                    )}
                  />
                  <Alert
                    severity='info'
                    sx={{ fontSize: `0.875rem` }}
                  >
                    Domains where this provider&apos;s secret can be sent. Leave empty to
                    allow all domains. Supports wildcards (e.g. *.example.com)
                  </Alert>
                </Box>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Custom Headers */}
          {!isDockerType && !isGitType && (
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
                    sx={{ ml: 1 }}
                    label={headers.length}
                  />
                )}
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <KeyValueEditor
                    pairs={headers}
                    disabled={loading}
                    secrets={orgSecrets}
                    onChange={setHeaders}
                    keyPlaceholder='Header Name'
                    enableSecretReferences={true}
                    valuePlaceholder='Header Value or {{secret-name}}'
                  />
                  <Alert
                    severity='info'
                    sx={{ fontSize: '0.875rem' }}
                  >
                    Custom headers included in provider API requests. Use {'{{'} and{' '}
                    {'}}'} to reference secrets.
                  </Alert>
                </Box>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Body Parameters */}
          {!isDockerType && !isGitType && (
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
                    sx={{ ml: 1 }}
                    label={bodyParams.length}
                  />
                )}
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <KeyValueEditor
                    pairs={bodyParams}
                    disabled={loading}
                    secrets={orgSecrets}
                    onChange={setBodyParams}
                    enableSecretReferences={true}
                    keyPlaceholder='Parameter Name'
                    valuePlaceholder='Value (supports JSON: numbers, booleans, objects)'
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
          )}
        </Box>
      </form>
    </Drawer>
  )
}
