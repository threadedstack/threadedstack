import type { TKeyValuePair } from '@TAF/types'
import type {
  TProto,
  Sandbox,
  Provider,
  TPortConfig,
  TSecretMode,
  TImagePullPolicy,
  TKubeSandboxConfig,
  TSandboxRuntimeId,
} from '@tdsk/domain'

import { Code } from '@TAF/components/Code/Code'
import { useState, useEffect, useMemo } from 'react'
import { MonacoOptions } from '@TAF/constants/monaco'
import { SBImagePresets } from '@TAF/constants/providers'
import { kvToObj, objToKV } from '@TAF/utils/transforms/kvs'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { createSecret } from '@TAF/actions/secrets/api/createSecret'
import { createSandbox, updateSandbox } from '@TAF/actions/sandboxes'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { ProviderLinkList } from '@TAF/components/Providers/ProviderLinkList'
import { SecretSelector } from '@TAF/components/SecretSelector/SecretSelector'
import { Drawer, TextInput, SelectInput, DrawerActions } from '@tdsk/components'
import {
  useProjects,
  useProviders,
  useOrgSecrets,
  useProjectSecrets,
  useProjectSandboxes,
} from '@TAF/state/selectors'
import {
  ESecretMode,
  ESandboxRuntime,
  SBRuntimeOptions,
  EImagePullPolicy,
  SandboxRuntimeOptions,
  SandboxRuntimeConfigs,
  RuntimeProviderEnvMap,
  SBImagePullPolicyOptions,
} from '@tdsk/domain'
import {
  Box,
  Chip,
  Alert,
  Button,
  Switch,
  Accordion,
  TextField,
  Typography,
  Autocomplete,
  FormControlLabel,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

export type TSandboxDrawer = {
  open: boolean
  orgId: string
  projectId?: string
  onClose: () => void
  onSuccess?: () => void
  sandbox?: Sandbox | null
  onRemove?: (sandbox: Sandbox) => void
}

export const SandboxDrawer = (props: TSandboxDrawer) => {
  const {
    open,
    orgId,
    sandbox,
    onRemove,
    projectId,
    onClose: onCloseCB,
    onSuccess: onSuccessCB,
  } = props

  const isEditMode = Boolean(sandbox)

  // Basic info
  const [name, setName] = useState(``)
  const [image, setImage] = useState(``)
  const [imagePullPolicy, setImagePullPolicy] = useState<TImagePullPolicy>(
    EImagePullPolicy.IfNotPresent
  )

  // Container
  const [args, setArgs] = useState(``)
  const [workdir, setWorkdir] = useState(``)
  const [command, setCommand] = useState(``)
  const [defaultRuntime, setDefaultRuntime] = useState(`node`)

  // Runtime (AI tool runtime)
  const [runtime, setRuntime] = useState<TSandboxRuntimeId>(ESandboxRuntime.claudeCode)
  const [runtimeCommand, setRuntimeCommand] = useState(``)
  const [initScript, setInitScript] = useState(``)

  // Resources
  const [cpuLimit, setCpuLimit] = useState(``)
  const [cpuRequest, setCpuRequest] = useState(``)
  const [memoryLimit, setMemoryLimit] = useState(``)
  const [memoryRequest, setMemoryRequest] = useState(``)

  // Image pull secret
  const [newSecretValue, setNewSecretValue] = useState(``)
  const [selectedSecretId, setSelectedSecretId] = useState(``)
  const [secretMode, setSecretMode] = useState<TSecretMode>(ESecretMode.none)

  // Git auth token secret
  const [gitTokenSecretId, setGitTokenSecretId] = useState(``)
  const [newGitTokenValue, setNewGitTokenValue] = useState(``)
  const [gitTokenMode, setGitTokenMode] = useState<TSecretMode>(ESecretMode.none)

  // SSH & config extras
  const [gitRepo, setGitRepo] = useState(``)
  const [gitBranch, setGitBranch] = useState(`main`)
  const [sshEnabled, setSshEnabled] = useState(true)
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState(30)

  // Key-value editors
  const [envVars, setEnvVars] = useState<TKeyValuePair[]>([])
  const [ports, setPorts] = useState<TKeyValuePair[]>([])

  // Secrets — merge org + project secrets when in project context
  const [orgSecretsMap] = useOrgSecrets()
  const [projectSecretsMap] = useProjectSecrets()
  const allSecrets = useMemo(() => {
    const org = Object.values(orgSecretsMap || {})
    const project = projectId ? Object.values(projectSecretsMap || {}) : []
    const merged = [...org, ...project]
    const seen = new Set<string>()
    return merged.filter((s) => {
      if (seen.has(s.id)) return false
      seen.add(s.id)
      return true
    })
  }, [orgSecretsMap, projectSecretsMap, projectId])

  // Project linking (org context only)
  const [projectsMap] = useProjects()
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const isProjectContext = !!projectId

  const orgProjects = useMemo(
    () => Object.values(projectsMap || {}).map((p) => ({ id: p.id, name: p.name })),
    [projectsMap]
  )

  // Base sandbox selector (project context, create mode only)
  const [projectSandboxesMap] = useProjectSandboxes()
  const [baseSandboxId, setBaseSandboxId] = useState<string | null>(null)

  const projectSandboxList = useMemo(
    () => Object.values(projectSandboxesMap || {}),
    [projectSandboxesMap]
  )

  // Provider linking
  const [providersMap] = useProviders()
  const [providerIds, setProviderIds] = useState<string[]>([])
  const [providerModels, setProviderModels] = useState<Record<string, string>>({})

  const orgProviders = useMemo(() => {
    if (!providersMap) return []
    return Object.values(providersMap).filter((p) => p.type === `ai`)
  }, [providersMap])

  const linkedProviders = useMemo(() => {
    return providerIds
      .map((id) => orgProviders.find((p) => p.id === id))
      .filter(Boolean) as Provider[]
  }, [providerIds, orgProviders])

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const secretOptions = allSecrets.map((s) => ({
    value: s.id,
    label: s.name || s.hashKey || s.id,
  }))

  const isCustomRuntime = runtime === ESandboxRuntime.custom
  const resolvedRuntimeCmd = !isCustomRuntime
    ? SandboxRuntimeConfigs[runtime]?.runtimeCommand || ``
    : ``
  const resolvedInitScript = !isCustomRuntime
    ? SandboxRuntimeConfigs[runtime]?.initScript || ``
    : ``

  const compatibleBrands = useMemo(() => {
    if (isCustomRuntime) return null
    const runtimeMap =
      RuntimeProviderEnvMap[runtime as keyof typeof RuntimeProviderEnvMap]
    if (!runtimeMap) return null
    const brands = Object.keys(runtimeMap)
    return brands.length > 0 ? brands : null
  }, [runtime, isCustomRuntime])

  const availableProviders = useMemo(() => {
    if (!orgProviders.length) return []
    const linkedSet = new Set(providerIds)
    return orgProviders.filter((p) => {
      if (linkedSet.has(p.id)) return false
      if (!compatibleBrands) return true
      return compatibleBrands.some((b) => b === p.brand || b.startsWith(`${p.brand}:`))
    })
  }, [orgProviders, providerIds, compatibleBrands])

  const onAddProvider = (provider: Provider) => {
    setProviderIds((prev) => [...prev, provider.id])
  }

  const onRemoveProvider = (providerId: string) => {
    setProviderIds((prev) => prev.filter((id) => id !== providerId))
  }

  const reset = () => {
    setName(``)
    setArgs(``)
    setImage(``)
    setPorts([])
    setEnvVars([])
    setGitRepo(``)
    setWorkdir(``)
    setCommand(``)
    setError(null)
    setProviderIds([])
    setProviderModels({})
    setCpuLimit(``)
    setCpuRequest(``)
    setMemoryLimit(``)
    setSshEnabled(true)
    setMemoryRequest(``)
    setGitBranch(`main`)
    setNewSecretValue(``)
    setBaseSandboxId(null)
    setNewGitTokenValue(``)
    setGitTokenSecretId(``)
    setSelectedSecretId(``)
    setSelectedProjectIds([])
    setDefaultRuntime(`node`)
    setIdleTimeoutMinutes(30)
    setSecretMode(ESecretMode.none)
    setGitTokenMode(ESecretMode.none)
    setImagePullPolicy(EImagePullPolicy.IfNotPresent)
    setRuntime(ESandboxRuntime.claudeCode)
    setRuntimeCommand(``)
    setInitScript(``)
  }

  const populateFromSandbox = (source: Sandbox) => {
    const config = source.config ?? ({} as TKubeSandboxConfig)
    setNewSecretValue(``)
    setNewGitTokenValue(``)
    setName(source.name || ``)
    setImage(config.image || ``)
    setWorkdir(config.workdir || ``)
    setGitRepo(config.gitRepo || ``)
    setArgs(config.args?.join(`, `) || ``)
    setGitBranch(config.gitBranch || `main`)
    setSshEnabled(config.sshEnabled ?? true)
    setEnvVars(objToKV(config.envVars, `env`))
    setCommand(config.command?.join(`, `) || ``)
    setCpuLimit(config.resources?.limits?.cpu || ``)
    setDefaultRuntime(config.defaultRuntime || `node`)
    setCpuRequest(config.resources?.requests?.cpu || ``)
    setIdleTimeoutMinutes(config.idleTimeoutMinutes ?? 30)
    setMemoryLimit(config.resources?.limits?.memory || ``)
    setMemoryRequest(config.resources?.requests?.memory || ``)
    setImagePullPolicy(config.imagePullPolicy || EImagePullPolicy.IfNotPresent)
    setRuntime((config.runtime as TSandboxRuntimeId) || ESandboxRuntime.claudeCode)
    setRuntimeCommand(config.runtimeCommand || ``)
    setInitScript(config.initScript || ``)
    setProviderIds(source.providerLinks?.map((l) => l.provider.id) || [])
    const models: Record<string, string> = {}
    for (const link of source.providerLinks || []) {
      if (link.model) models[link.provider.id] = link.model
    }
    setProviderModels(models)

    if (config.gitTokenSecretId) {
      setGitTokenSecretId(config.gitTokenSecretId)
      setGitTokenMode(ESecretMode.existing)
    } else {
      setGitTokenSecretId(``)
      setGitTokenMode(ESecretMode.none)
    }
    setPorts(
      Object.entries(config.ports || {}).map(([key, val], i) => ({
        id: `port-${i}-${Date.now()}`,
        key,
        value: val.protocol || `http`,
      }))
    )

    if (config.imagePullSecret) {
      setSelectedSecretId(config.imagePullSecret)
      setSecretMode(ESecretMode.existing)
    } else {
      setSelectedSecretId(``)
      setSecretMode(ESecretMode.none)
    }

    setError(null)
  }

  const onSelectBaseSandbox = (id: string | null) => {
    setBaseSandboxId(id)
    if (!id) {
      reset()
      return
    }
    const base = projectSandboxList.find((s) => s.id === id)
    if (base) populateFromSandbox(base)
  }

  // Pre-populate form in edit mode
  useEffect(() => {
    if (sandbox) {
      populateFromSandbox(sandbox)
      setSelectedProjectIds(
        sandbox.projects?.map((p) => p.id) || (projectId ? [projectId] : [])
      )
    } else reset()
  }, [sandbox])

  const onClose = () => {
    if (loading) return
    reset()
    onCloseCB?.()
  }

  const splitCSV = (val: string) =>
    val
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!name.trim()) return setError(`Sandbox name is required`)
    if (!image.trim()) return setError(`Container image is required`)
    if (secretMode === ESecretMode.new && !newSecretValue.trim())
      return setError(`Secret value is required for new image pull secret`)
    if (gitTokenMode === ESecretMode.new && !newGitTokenValue.trim())
      return setError(`Secret value is required for new git auth token`)

    setLoading(true)
    setError(null)

    // Build resources object, omitting empty strings
    const resources: Record<string, Record<string, string>> = {}
    if (cpuLimit || memoryLimit) {
      resources.limits = {}
      if (cpuLimit) resources.limits.cpu = cpuLimit
      if (memoryLimit) resources.limits.memory = memoryLimit
    }
    if (cpuRequest || memoryRequest) {
      resources.requests = {}
      if (cpuRequest) resources.requests.cpu = cpuRequest
      if (memoryRequest) resources.requests.memory = memoryRequest
    }

    // Build ports object
    const portsObj: Record<string, TPortConfig> = {}
    for (const p of ports) {
      if (p.key.trim())
        portsObj[p.key.trim()] = { protocol: (p.value || 'http') as TProto }
    }

    // Resolve image pull secret
    let imagePullSecret: string | undefined
    if (secretMode === ESecretMode.existing && selectedSecretId) {
      imagePullSecret = selectedSecretId
    } else if (secretMode === ESecretMode.new && newSecretValue.trim()) {
      const secretName = `${name.trim().toUpperCase().replace(/\s+/g, '_')}_PULL_SECRET`
      const secretResult = await createSecret({
        orgId,
        name: secretName,
        value: newSecretValue.trim(),
      })
      if (secretResult.error) {
        setLoading(false)
        return setError(
          `Failed to create image pull secret: ${secretResult.error.message}`
        )
      }
      imagePullSecret = secretResult.data?.id
    }

    // Resolve git auth token secret
    let resolvedGitTokenSecretId: string | undefined
    if (gitTokenMode === ESecretMode.existing && gitTokenSecretId) {
      resolvedGitTokenSecretId = gitTokenSecretId
    } else if (gitTokenMode === ESecretMode.new && newGitTokenValue.trim()) {
      const tokenSecretName = `${name.trim().toUpperCase().replace(/\s+/g, '_')}_GIT_TOKEN`
      const tokenResult = await createSecret({
        orgId,
        projectId,
        name: tokenSecretName,
        value: newGitTokenValue.trim(),
      })
      if (tokenResult.error) {
        setLoading(false)
        return setError(
          `Failed to create git auth token secret: ${tokenResult.error.message}`
        )
      }
      resolvedGitTokenSecretId = tokenResult.data?.id
    }

    const commandArr = splitCSV(command)
    const argsArr = splitCSV(args)
    const envVarsObj = kvToObj(envVars, false)

    const effectiveRuntimeCmd = isCustomRuntime ? runtimeCommand : resolvedRuntimeCmd
    const effectiveInitScript = isCustomRuntime
      ? initScript
      : initScript || resolvedInitScript

    const sandboxData = {
      name: name.trim(),
      ...(!isProjectContext && { projectIds: selectedProjectIds }),
      providerInputs: providerIds.map((id) => ({
        id,
        model: providerModels[id] || null,
      })),
      config: {
        runtime,
        sshEnabled,
        idleTimeoutMinutes,
        image: image.trim(),
        imagePullPolicy: imagePullPolicy as TImagePullPolicy,
        ...(effectiveRuntimeCmd ? { runtimeCommand: effectiveRuntimeCmd } : {}),
        ...(effectiveInitScript ? { initScript: effectiveInitScript } : {}),
        ...(defaultRuntime ? { defaultRuntime } : {}),
        ...(imagePullSecret ? { imagePullSecret } : {}),
        ...(argsArr.length > 0 ? { args: argsArr } : {}),
        ...(gitRepo.trim() ? { gitRepo: gitRepo.trim() } : {}),
        ...(workdir.trim() ? { workdir: workdir.trim() } : {}),
        ...(commandArr.length > 0 ? { command: commandArr } : {}),
        ...(Object.keys(resources).length > 0 ? { resources } : {}),
        ...(gitRepo.trim() && gitBranch.trim() ? { gitBranch: gitBranch.trim() } : {}),
        ...(Object.keys(portsObj).length > 0 ? { ports: portsObj } : {}),
        ...(Object.keys(envVarsObj).length > 0 ? { envVars: envVarsObj } : {}),
        ...(resolvedGitTokenSecretId
          ? { gitTokenSecretId: resolvedGitTokenSecretId }
          : {}),
      },
    }

    const result =
      isEditMode && sandbox
        ? await updateSandbox({ orgId, projectId, id: sandbox.id, data: sandboxData })
        : await createSandbox({ orgId, projectId, data: sandboxData })

    if (result.error) {
      setLoading(false)
      return setError(
        `Failed to ${isEditMode ? `update` : `create`} sandbox config: ${result.error?.message || `Please try again.`}`
      )
    }

    setLoading(false)
    onSuccessCB?.()
    onClose()
  }

  const { actions } = useDrawerActions({
    onSave,
    onClose,
    onRemove: sandbox ? () => onRemove?.(sandbox) : undefined,
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEditMode ? 'Edit Sandbox Config' : 'Create Sandbox Config'}
      actions={
        <DrawerActions
          form='sandbox-form'
          actions={actions}
          loading={loading}
          disabled={loading}
          editing={isEditMode}
        />
      }
    >
      <form id='sandbox-form'>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && (
            <ErrorAlert
              message={error}
              onClose={() => setError(null)}
            />
          )}

          {/* Basic Info */}
          <TextInput
            required
            fullWidth
            value={name}
            label='Name'
            id='sandbox-name'
            disabled={loading}
            placeholder='Enter sandbox name'
            onChange={(e) => setName(e.target.value)}
          />

          {/* Project linking — org context only */}
          {!isProjectContext && (
            <Autocomplete
              multiple
              id='sandbox-projects'
              value={selectedProjectIds}
              options={orgProjects.map((p) => p.id)}
              getOptionLabel={(id) => orgProjects.find((p) => p.id === id)?.name || id}
              onChange={(_, updates) => setSelectedProjectIds(updates)}
              disabled={loading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label='Projects'
                  placeholder='Select projects...'
                  size='small'
                />
              )}
            />
          )}

          {/* Base sandbox selector — project context, create mode only */}
          {isProjectContext && !isEditMode && projectSandboxList.length > 0 && (
            <Autocomplete
              id='sandbox-base'
              value={baseSandboxId}
              options={projectSandboxList.map((s) => s.id)}
              getOptionLabel={(id) =>
                projectSandboxList.find((s) => s.id === id)?.name || id
              }
              onChange={(_, id) => onSelectBaseSandbox(id)}
              disabled={loading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label='Base Sandbox'
                  placeholder='Start from an existing sandbox...'
                  size='small'
                />
              )}
            />
          )}

          {/* Image Presets */}
          <Box>
            <Typography
              variant='caption'
              color='text.secondary'
              sx={{ mb: 0.5, display: 'block' }}
            >
              Image Presets
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {SBImagePresets.map((preset) => (
                <Button
                  size='small'
                  disabled={loading}
                  key={preset.label}
                  onClick={() => setImage(preset.value)}
                  variant={image === preset.value ? 'contained' : 'outlined'}
                >
                  {preset.label}
                </Button>
              ))}
            </Box>
          </Box>

          <TextInput
            required
            fullWidth
            value={image}
            id='sandbox-image'
            disabled={loading}
            label='Container Image'
            placeholder='e.g. node:20-slim'
            onChange={(e) => setImage(e.target.value)}
          />

          <SelectInput
            id='sandbox-pull-policy'
            label='Image Pull Policy'
            value={imagePullPolicy}
            items={SBImagePullPolicyOptions}
            disabled={loading}
            onChange={(e) => setImagePullPolicy(e.target.value as TImagePullPolicy)}
          />

          {/* Runtime */}
          <SelectInput
            id='sandbox-runtime-type'
            label='Runtime'
            value={runtime}
            items={SandboxRuntimeOptions}
            disabled={loading}
            onChange={(e) => setRuntime(e.target.value as TSandboxRuntimeId)}
          />

          <TextInput
            fullWidth
            disabled={!isCustomRuntime || loading}
            id='sandbox-runtime-command'
            label='Runtime Command'
            placeholder={isCustomRuntime ? `e.g. my-ai-tool` : ``}
            value={isCustomRuntime ? runtimeCommand : resolvedRuntimeCmd}
            onChange={(e) => setRuntimeCommand(e.target.value)}
            helperText={
              !isCustomRuntime
                ? `Pre-configured for ${SandboxRuntimeOptions.find((o) => o.value === runtime)?.label || runtime}`
                : undefined
            }
          />

          {/* Init Script */}
          <Box>
            <Typography
              variant='caption'
              color='text.secondary'
              sx={{ mb: 0.5, display: 'block' }}
            >
              Init Script
              {!isCustomRuntime && (
                <Typography
                  component='span'
                  variant='caption'
                  color='text.secondary'
                  sx={{ ml: 1 }}
                >
                  (pre-filled from{' '}
                  {SandboxRuntimeOptions.find((o) => o.value === runtime)?.label ||
                    runtime}{' '}
                  preset)
                </Typography>
              )}
            </Typography>
            <Code
              id='sandbox-init-script'
              language='shell'
              disabled={loading}
              options={MonacoOptions}
              defaultValue={initScript || (!isCustomRuntime ? resolvedInitScript : ``)}
              label=''
              onChange={(value) => setInitScript(value || ``)}
              sx={{ minHeight: 120 }}
            />
          </Box>

          {/* Timeout */}
          <TextInput
            fullWidth
            type='number'
            placeholder='30'
            disabled={loading}
            id='sandbox-idle-timeout'
            label='Idle timeout (minutes)'
            value={String(idleTimeoutMinutes)}
            onChange={(e) => setIdleTimeoutMinutes(Number(e.target.value))}
          />

          {/* SSH Enabled */}
          <FormControlLabel
            control={
              <Switch
                disabled={loading}
                checked={sshEnabled}
                onChange={(e) => setSshEnabled(e.target.checked)}
              />
            }
            label='SSH Enabled'
          />

          {/* Container */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                fontWeight={500}
                variant='subtitle1'
              >
                Container
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextInput
                  fullWidth
                  value={workdir}
                  disabled={loading}
                  placeholder='/app'
                  id='sandbox-workdir'
                  label='Working Directory'
                  onChange={(e) => setWorkdir(e.target.value)}
                />

                <TextInput
                  fullWidth
                  value={command}
                  label='Command'
                  disabled={loading}
                  id='sandbox-command'
                  placeholder='Comma-separated, e.g. /bin/sh, -c'
                  onChange={(e) => setCommand(e.target.value)}
                />

                <TextInput
                  fullWidth
                  value={args}
                  label='Args'
                  id='sandbox-args'
                  disabled={loading}
                  placeholder='Comma-separated'
                  onChange={(e) => setArgs(e.target.value)}
                />

                <SelectInput
                  id='sandbox-runtime'
                  disabled={loading}
                  value={defaultRuntime}
                  label='Default Runtime'
                  items={SBRuntimeOptions}
                  onChange={(e) => setDefaultRuntime(e.target.value)}
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Resources */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                fontWeight={500}
                variant='subtitle1'
              >
                Resources
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextInput
                    fullWidth
                    value={cpuLimit}
                    label='CPU Limit'
                    disabled={loading}
                    placeholder='500m'
                    id='sandbox-cpu-limit'
                    onChange={(e) => setCpuLimit(e.target.value)}
                  />
                  <TextInput
                    fullWidth
                    value={memoryLimit}
                    disabled={loading}
                    label='Memory Limit'
                    placeholder='256Mi'
                    id='sandbox-memory-limit'
                    onChange={(e) => setMemoryLimit(e.target.value)}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextInput
                    fullWidth
                    value={cpuRequest}
                    disabled={loading}
                    label='CPU Request'
                    placeholder='100m'
                    id='sandbox-cpu-request'
                    onChange={(e) => setCpuRequest(e.target.value)}
                  />
                  <TextInput
                    fullWidth
                    disabled={loading}
                    placeholder='128Mi'
                    label='Memory Request'
                    value={memoryRequest}
                    id='sandbox-memory-request'
                    onChange={(e) => setMemoryRequest(e.target.value)}
                  />
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Git Repository */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                fontWeight={500}
                variant='subtitle1'
              >
                Git Repository
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextInput
                  fullWidth
                  value={gitRepo}
                  disabled={loading}
                  id='sandbox-git-repo'
                  label='Git Repository URL'
                  placeholder='https://github.com/org/repo.git'
                  onChange={(e) => setGitRepo(e.target.value)}
                />
                <TextInput
                  fullWidth
                  value={gitBranch}
                  disabled={loading}
                  label='Git Branch'
                  placeholder='main'
                  id='sandbox-git-branch'
                  onChange={(e) => setGitBranch(e.target.value)}
                />
                <SecretSelector
                  mode={gitTokenMode}
                  disabled={loading}
                  editing={isEditMode}
                  secretOptions={secretOptions}
                  editLabel='Change Auth Token'
                  newSecretValue={newGitTokenValue}
                  selectedSecretId={gitTokenSecretId}
                  onSecretSelect={setGitTokenSecretId}
                  label='Auth Token (for private repos)'
                  onNewValueChange={setNewGitTokenValue}
                  valuePlaceholder='Enter git auth token (e.g. GitHub PAT)...'
                  onModeChange={(mode) => {
                    setGitTokenMode(mode)
                    setNewGitTokenValue(``)
                    setGitTokenSecretId(``)
                  }}
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Image Pull Secret */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                fontWeight={500}
                variant='subtitle1'
              >
                Image Pull Secret
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <SecretSelector
                mode={secretMode}
                disabled={loading}
                editing={isEditMode}
                label='Image Pull Secret'
                secretOptions={secretOptions}
                newSecretValue={newSecretValue}
                selectedSecretId={selectedSecretId}
                editLabel='Change Image Pull Secret'
                onSecretSelect={setSelectedSecretId}
                onNewValueChange={setNewSecretValue}
                valuePlaceholder='Enter image pull secret...'
                onModeChange={(mode) => {
                  setSecretMode(mode)
                  setNewSecretValue('')
                  setSelectedSecretId('')
                }}
              />
            </AccordionDetails>
          </Accordion>

          {/* Providers */}
          <Accordion defaultExpanded={false}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                fontWeight={500}
                variant='subtitle1'
              >
                Providers
              </Typography>
              {linkedProviders.length > 0 && (
                <Chip
                  size='small'
                  sx={{ ml: 1 }}
                  label={linkedProviders.length}
                />
              )}
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {!isCustomRuntime && linkedProviders.length === 0 && !!providersMap && (
                  <Alert
                    severity='info'
                    sx={{ mb: 1 }}
                  >
                    No provider linked. The AI tool will need credentials to authenticate.
                    Link a compatible provider below.
                  </Alert>
                )}

                <ProviderLinkList
                  reorderable
                  loading={!providersMap}
                  disabled={loading}
                  providers={linkedProviders.map((p) => ({
                    id: p.id,
                    name: p.name || p.id,
                    brand: p.brand,
                    model: providerModels[p.id] ?? null,
                  }))}
                  availableProviders={availableProviders.map((p) => ({
                    id: p.id,
                    name: p.name || p.id,
                    brand: p.brand,
                  }))}
                  onAdd={(p) =>
                    onAddProvider({
                      id: p.id,
                      brand: p.brand,
                      name: p.name,
                      type: 'ai',
                    } as Provider)
                  }
                  onReorder={(items) => setProviderIds(items.map((p) => p.id))}
                  onModelChange={(id, model) =>
                    setProviderModels((prev) => ({ ...prev, [id]: model }))
                  }
                  onRemove={(id) => {
                    onRemoveProvider(id)
                    setProviderModels((prev) => {
                      const updated = { ...prev }
                      delete updated[id]
                      return updated
                    })
                  }}
                />

                {!!providersMap &&
                  availableProviders.length === 0 &&
                  linkedProviders.length > 0 && (
                    <Typography
                      variant='caption'
                      color='text.secondary'
                    >
                      All compatible providers have been linked.
                    </Typography>
                  )}

                {compatibleBrands && (
                  <Typography
                    variant='caption'
                    color='text.secondary'
                  >
                    Compatible brands for{' '}
                    {SandboxRuntimeOptions.find((o) => o.value === runtime)?.label ||
                      runtime}
                    : {compatibleBrands.filter((b) => !b.includes(':')).join(', ')}
                  </Typography>
                )}
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Environment Variables */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                variant='subtitle1'
                fontWeight={500}
              >
                Environment Variables
              </Typography>
              {envVars.length > 0 && (
                <Chip
                  size='small'
                  sx={{ ml: 1 }}
                  label={envVars.length}
                />
              )}
            </AccordionSummary>
            <AccordionDetails>
              <KeyValueEditor
                pairs={envVars}
                disabled={loading}
                secrets={allSecrets}
                onChange={setEnvVars}
                enableSecretReferences={true}
                keyPlaceholder='Variable Name'
                valuePlaceholder='Value or {{secret-name}}'
              />
            </AccordionDetails>
          </Accordion>

          {/* Ports */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                fontWeight={500}
                variant='subtitle1'
              >
                Ports
              </Typography>
              {ports.length > 0 && (
                <Chip
                  size='small'
                  sx={{ ml: 1 }}
                  label={ports.length}
                />
              )}
            </AccordionSummary>
            <AccordionDetails>
              <KeyValueEditor
                pairs={ports}
                disabled={loading}
                onChange={setPorts}
                enableSecretReferences={false}
                keyPlaceholder='Port Name (e.g. web)'
                valuePlaceholder='Protocol (http/https)'
              />
            </AccordionDetails>
          </Accordion>
        </Box>
      </form>
    </Drawer>
  )
}
