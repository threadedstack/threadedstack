import type { TKeyValuePair } from '@TAF/types'
import type {
  TProto,
  Sandbox,
  TPortConfig,
  TSecretMode,
  TImagePullPolicy,
  TKubeSandboxConfig,
} from '@tdsk/domain'

import { useState, useEffect, useMemo } from 'react'
import { kvToObj, objToKV } from '@TAF/utils/transforms/kvs'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { createSecret } from '@TAF/actions/secrets/api/createSecret'
import { createSandbox, updateSandbox } from '@TAF/actions/sandboxes'
import { useOrgSecrets, useProjectSecrets } from '@TAF/state/selectors'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { SecretSelector } from '@TAF/components/SecretSelector/SecretSelector'
import { Drawer, TextInput, SelectInput, DrawerActions } from '@tdsk/components'
import {
  ESecretMode,
  SBImagePresets,
  SBRuntimeOptions,
  EImagePullPolicy,
  SBImagePullPolicyOptions,
} from '@tdsk/domain'
import {
  Box,
  Chip,
  Button,
  Switch,
  Accordion,
  Typography,
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

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const secretOptions = allSecrets.map((s) => ({
    value: s.id,
    label: s.name || s.hashKey || s.id,
  }))

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
    setCpuLimit(``)
    setCpuRequest(``)
    setMemoryLimit(``)
    setSshEnabled(true)
    setMemoryRequest(``)
    setGitBranch(`main`)
    setNewSecretValue(``)
    setNewGitTokenValue(``)
    setGitTokenSecretId(``)
    setSelectedSecretId(``)
    setDefaultRuntime(`node`)
    setIdleTimeoutMinutes(30)
    setSecretMode(ESecretMode.none)
    setGitTokenMode(ESecretMode.none)
    setImagePullPolicy(EImagePullPolicy.IfNotPresent)
  }

  // Pre-populate form in edit mode
  useEffect(() => {
    if (sandbox) {
      const config = sandbox.config ?? ({} as TKubeSandboxConfig)
      setNewSecretValue(``)
      setNewGitTokenValue(``)
      setName(sandbox.name || '')
      setImage(config.image || '')
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

      setError(null)

      if (config.imagePullSecret) {
        setSelectedSecretId(config.imagePullSecret)
        setSecretMode(ESecretMode.existing)
      } else {
        setSelectedSecretId(``)
        setSecretMode(ESecretMode.none)
      }
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

    const sandboxData: Partial<Sandbox> = {
      name: name.trim(),
      config: {
        sshEnabled,
        idleTimeoutMinutes,
        image: image.trim(),
        imagePullPolicy: imagePullPolicy as TImagePullPolicy,
        ...(defaultRuntime ? { defaultRuntime } : {}),
        ...(imagePullSecret ? { imagePullSecret } : {}),
        ...(argsArr.length > 0 ? { args: argsArr } : {}),
        ...(gitRepo.trim() ? { gitRepo: gitRepo.trim() } : {}),
        ...(workdir.trim() ? { workdir: workdir.trim() } : {}),
        ...(commandArr.length > 0 ? { command: commandArr } : {}),
        ...(Object.keys(resources).length > 0 ? { resources } : {}),
        ...(gitBranch.trim() ? { gitBranch: gitBranch.trim() } : {}),
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
        `Failed to ${isEditMode ? `update` : `create`} sandbox config. Please try again.`
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
                  key={preset.value}
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
