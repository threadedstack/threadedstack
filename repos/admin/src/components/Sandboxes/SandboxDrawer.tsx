import type { TKeyValuePair } from '@TAF/types'
import type {
  TProto,
  Sandbox,
  TPortConfig,
  TSecretMode,
  TKubeSandboxConfig,
} from '@tdsk/domain'

import { ESecretMode } from '@tdsk/domain'
import { useState, useEffect, useMemo } from 'react'
import { useOrgSecrets } from '@TAF/state/selectors'
import { kvToObj, objToKV } from '@TAF/utils/transforms/kvs'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { createSecret } from '@TAF/actions/secrets/api/createSecret'
import { createSandbox, updateSandbox } from '@TAF/actions/sandboxes'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { SecretSelector } from '@TAF/components/SecretSelector/SecretSelector'
import { Drawer, TextInput, SelectInput, DrawerActions } from '@tdsk/components'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import {
  Box,
  Chip,
  Accordion,
  Typography,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

const ImagePullPolicyOptions = [
  { value: 'Always', label: 'Always' },
  { value: 'IfNotPresent', label: 'IfNotPresent' },
  { value: 'Never', label: 'Never' },
]

const RuntimeOptions = [
  { value: 'node', label: 'Node.js' },
  { value: 'python', label: 'Python' },
]

export type TSandboxDrawer = {
  open: boolean
  orgId: string
  sandbox?: Sandbox | null
  onClose: () => void
  onSuccess?: () => void
  onRemove?: (sandbox: Sandbox) => void
}

export const SandboxDrawer = ({
  open,
  orgId,
  sandbox,
  onRemove,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TSandboxDrawer) => {
  const isEditMode = Boolean(sandbox)

  // Basic info
  const [name, setName] = useState('')
  const [image, setImage] = useState('')
  const [imagePullPolicy, setImagePullPolicy] = useState('IfNotPresent')

  // Container
  const [workdir, setWorkdir] = useState('')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [defaultRuntime, setDefaultRuntime] = useState('node')

  // Resources
  const [cpuLimit, setCpuLimit] = useState('')
  const [memoryLimit, setMemoryLimit] = useState('')
  const [cpuRequest, setCpuRequest] = useState('')
  const [memoryRequest, setMemoryRequest] = useState('')

  // Image pull secret
  const [secretMode, setSecretMode] = useState<TSecretMode>(ESecretMode.none)
  const [selectedSecretId, setSelectedSecretId] = useState('')
  const [newSecretValue, setNewSecretValue] = useState('')

  // Key-value editors
  const [envVars, setEnvVars] = useState<TKeyValuePair[]>([])
  const [ports, setPorts] = useState<TKeyValuePair[]>([])

  // Jotai state — replace local orgSecrets fetch
  const [orgSecretsMap] = useOrgSecrets()
  const orgSecrets = useMemo(() => Object.values(orgSecretsMap || {}), [orgSecretsMap])

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const secretOptions = orgSecrets.map((s) => ({
    value: s.id,
    label: s.name || s.hashKey || s.id,
  }))

  // Pre-populate form in edit mode
  useEffect(() => {
    if (sandbox) {
      const config = sandbox.config ?? ({} as TKubeSandboxConfig)
      setName(sandbox.name || '')
      setImage(config.image || '')
      setImagePullPolicy(config.imagePullPolicy || 'IfNotPresent')
      setWorkdir(config.workdir || '')
      setCommand(config.command?.join(', ') || '')
      setArgs(config.args?.join(', ') || '')
      setDefaultRuntime(config.defaultRuntime || 'node')
      setCpuLimit(config.resources?.limits?.cpu || '')
      setMemoryLimit(config.resources?.limits?.memory || '')
      setCpuRequest(config.resources?.requests?.cpu || '')
      setMemoryRequest(config.resources?.requests?.memory || '')
      setEnvVars(objToKV(config.envVars, 'env'))
      setPorts(
        Object.entries(config.ports || {}).map(([key, val], i) => ({
          id: `port-${i}-${Date.now()}`,
          key,
          value: val.protocol || 'http',
        }))
      )
      setError(null)
      setNewSecretValue('')

      if (config.imagePullSecret) {
        setSelectedSecretId(config.imagePullSecret)
        setSecretMode(ESecretMode.existing)
      } else {
        setSelectedSecretId('')
        setSecretMode(ESecretMode.none)
      }
    } else {
      setName('')
      setImage('')
      setImagePullPolicy('IfNotPresent')
      setWorkdir('')
      setCommand('')
      setArgs('')
      setDefaultRuntime('node')
      setCpuLimit('')
      setMemoryLimit('')
      setCpuRequest('')
      setMemoryRequest('')
      setEnvVars([])
      setPorts([])
      setError(null)
      setNewSecretValue('')
      setSelectedSecretId('')
      setSecretMode(ESecretMode.none)
    }
  }, [sandbox])

  const onClose = () => {
    if (loading) return

    setName('')
    setImage('')
    setImagePullPolicy('IfNotPresent')
    setWorkdir('')
    setCommand('')
    setArgs('')
    setDefaultRuntime('node')
    setCpuLimit('')
    setMemoryLimit('')
    setCpuRequest('')
    setMemoryRequest('')
    setEnvVars([])
    setPorts([])
    setError(null)
    setNewSecretValue('')
    setSelectedSecretId('')
    setSecretMode(ESecretMode.none)
    onCloseCB?.()
  }

  const splitCSV = (val: string) =>
    val
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!name.trim()) return setError('Sandbox name is required')
    if (!image.trim()) return setError('Container image is required')
    if (secretMode === ESecretMode.new && !newSecretValue.trim())
      return setError('Secret value is required for new image pull secret')

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

    const commandArr = splitCSV(command)
    const argsArr = splitCSV(args)
    const envVarsObj = kvToObj(envVars, false)

    const sandboxData: Partial<Sandbox> = {
      name: name.trim(),
      config: {
        image: image.trim(),
        imagePullPolicy: imagePullPolicy as 'Always' | 'IfNotPresent' | 'Never',
        ...(workdir.trim() ? { workdir: workdir.trim() } : {}),
        ...(commandArr.length > 0 ? { command: commandArr } : {}),
        ...(argsArr.length > 0 ? { args: argsArr } : {}),
        ...(defaultRuntime ? { defaultRuntime } : {}),
        ...(Object.keys(resources).length > 0 ? { resources } : {}),
        ...(Object.keys(portsObj).length > 0 ? { ports: portsObj } : {}),
        ...(Object.keys(envVarsObj).length > 0 ? { envVars: envVarsObj } : {}),
        ...(imagePullSecret ? { imagePullSecret } : {}),
      },
    }

    const result =
      isEditMode && sandbox
        ? await updateSandbox({ orgId, id: sandbox.id, data: sandboxData })
        : await createSandbox({ orgId, data: sandboxData })

    if (result.error) {
      setLoading(false)
      return setError(
        `Failed to ${isEditMode ? 'update' : 'create'} sandbox config. Please try again.`
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
          editing={isEditMode}
          actions={actions}
          loading={loading}
          disabled={loading}
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
            id='sandbox-name'
            disabled={loading}
            label='Name'
            placeholder='Enter sandbox name'
            onChange={(e) => setName(e.target.value)}
          />

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
            items={ImagePullPolicyOptions}
            disabled={loading}
            onChange={(e) => setImagePullPolicy(e.target.value)}
          />

          {/* Container */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                variant='subtitle1'
                fontWeight={500}
              >
                Container
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextInput
                  fullWidth
                  value={workdir}
                  id='sandbox-workdir'
                  disabled={loading}
                  label='Working Directory'
                  placeholder='/app'
                  onChange={(e) => setWorkdir(e.target.value)}
                />

                <TextInput
                  fullWidth
                  value={command}
                  id='sandbox-command'
                  disabled={loading}
                  label='Command'
                  placeholder='Comma-separated, e.g. /bin/sh, -c'
                  onChange={(e) => setCommand(e.target.value)}
                />

                <TextInput
                  fullWidth
                  value={args}
                  id='sandbox-args'
                  disabled={loading}
                  label='Args'
                  placeholder='Comma-separated'
                  onChange={(e) => setArgs(e.target.value)}
                />

                <SelectInput
                  id='sandbox-runtime'
                  label='Default Runtime'
                  value={defaultRuntime}
                  items={RuntimeOptions}
                  disabled={loading}
                  onChange={(e) => setDefaultRuntime(e.target.value)}
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Resources */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                variant='subtitle1'
                fontWeight={500}
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
                    id='sandbox-cpu-limit'
                    disabled={loading}
                    label='CPU Limit'
                    placeholder='500m'
                    onChange={(e) => setCpuLimit(e.target.value)}
                  />
                  <TextInput
                    fullWidth
                    value={memoryLimit}
                    id='sandbox-memory-limit'
                    disabled={loading}
                    label='Memory Limit'
                    placeholder='256Mi'
                    onChange={(e) => setMemoryLimit(e.target.value)}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextInput
                    fullWidth
                    value={cpuRequest}
                    id='sandbox-cpu-request'
                    disabled={loading}
                    label='CPU Request'
                    placeholder='100m'
                    onChange={(e) => setCpuRequest(e.target.value)}
                  />
                  <TextInput
                    fullWidth
                    value={memoryRequest}
                    id='sandbox-memory-request'
                    disabled={loading}
                    label='Memory Request'
                    placeholder='128Mi'
                    onChange={(e) => setMemoryRequest(e.target.value)}
                  />
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Image Pull Secret */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                variant='subtitle1'
                fontWeight={500}
              >
                Image Pull Secret
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <SecretSelector
                label='Image Pull Secret'
                editLabel='Change Image Pull Secret'
                editing={isEditMode}
                disabled={loading}
                mode={secretMode}
                selectedSecretId={selectedSecretId}
                newSecretValue={newSecretValue}
                onModeChange={(mode) => {
                  setSecretMode(mode)
                  setNewSecretValue('')
                  setSelectedSecretId('')
                }}
                onSecretSelect={setSelectedSecretId}
                onNewValueChange={setNewSecretValue}
                secretOptions={secretOptions}
                valuePlaceholder='Enter image pull secret...'
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
                  label={envVars.length}
                  sx={{ ml: 1 }}
                />
              )}
            </AccordionSummary>
            <AccordionDetails>
              <KeyValueEditor
                pairs={envVars}
                disabled={loading}
                secrets={orgSecrets}
                keyPlaceholder='Variable Name'
                valuePlaceholder='Value or {{secret-name}}'
                enableSecretReferences={true}
                onChange={setEnvVars}
              />
            </AccordionDetails>
          </Accordion>

          {/* Ports */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                variant='subtitle1'
                fontWeight={500}
              >
                Ports
              </Typography>
              {ports.length > 0 && (
                <Chip
                  size='small'
                  label={ports.length}
                  sx={{ ml: 1 }}
                />
              )}
            </AccordionSummary>
            <AccordionDetails>
              <KeyValueEditor
                pairs={ports}
                disabled={loading}
                keyPlaceholder='Port Name (e.g. web)'
                valuePlaceholder='Protocol (http/https)'
                enableSecretReferences={false}
                onChange={setPorts}
              />
            </AccordionDetails>
          </Accordion>
        </Box>
      </form>
    </Drawer>
  )
}
