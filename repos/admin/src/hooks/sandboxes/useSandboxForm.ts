import type { TKeyValuePair } from '@TAF/types'
import type {
  TProto,
  Sandbox,
  Provider,
  TPortConfig,
  TSecretMode,
  TGuiConfig,
  TImagePullPolicy,
  TKubeSandboxConfig,
  TSandboxRuntimeId,
} from '@tdsk/domain'

import { useState, useEffect, useMemo } from 'react'
import { TDSK_SB_IMAGE_FULL } from '@TAF/constants/envs'
import { kvToObj, objToKV } from '@TAF/utils/transforms/kvs'
import { createSecret } from '@TAF/actions/secrets/api/createSecret'
import { createSandbox, updateSandbox } from '@TAF/actions/sandboxes'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import {
  EProvider,
  ESecretMode,
  ESandboxRuntime,
  EImagePullPolicy,
  SandboxPresets,
  SandboxRuntimeConfigs,
  RuntimeProviderEnvMap,
} from '@tdsk/domain'
import {
  useProjects,
  useProviders,
  useOrgSecrets,
  useProjectSecrets,
  useProjectSandboxes,
} from '@TAF/state/selectors'

export type TUseSandboxFormParams = {
  orgId: string
  projectId?: string
  sandbox?: Sandbox | null
  onCloseCB?: () => void
  onSuccessCB?: () => void
  onRemove?: (sandbox: Sandbox) => void
}

export type TSandboxForm = ReturnType<typeof useSandboxForm>

export const useSandboxForm = (params: TUseSandboxFormParams) => {
  const { orgId, projectId, sandbox, onCloseCB, onSuccessCB, onRemove } = params

  const isEditMode = Boolean(sandbox)
  const isProjectContext = !!projectId

  // Basic info
  const [name, setName] = useState(``)
  const [image, setImage] = useState(``)
  const [alias, setAlias] = useState(``)
  const [imagePullPolicy, setImagePullPolicy] = useState<TImagePullPolicy>(
    EImagePullPolicy.IfNotPresent
  )

  // Container
  const [args, setArgs] = useState(``)
  const [workdir, setWorkdir] = useState(``)
  const [command, setCommand] = useState(``)

  // Runtime (AI tool runtime)
  const [runtime, setRuntime] = useState<TSandboxRuntimeId>(ESandboxRuntime.claudeCode)
  const [runtimeCommand, setRuntimeCommand] = useState(``)
  const [initScript, setInitScript] = useState(``)

  // Resources
  const [cpuLimit, setCpuLimit] = useState(``)
  const [cpuRequest, setCpuRequest] = useState(``)
  const [memoryLimit, setMemoryLimit] = useState(``)
  const [memoryRequest, setMemoryRequest] = useState(``)

  // Git auth token secret
  const [gitTokenSecretId, setGitTokenSecretId] = useState(``)
  const [newGitTokenValue, setNewGitTokenValue] = useState(``)
  const [gitTokenMode, setGitTokenMode] = useState<TSecretMode>(ESecretMode.none)

  // SSH & config extras
  const [gitRepo, setGitRepo] = useState(``)
  const [gitBranch, setGitBranch] = useState(`main`)
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
  const [dockerProviderIds, setDockerProviderIds] = useState<string[]>([])

  const orgProviders = useMemo(() => {
    if (!providersMap) return []
    return Object.values(providersMap).filter((p) => p.type === `ai`)
  }, [providersMap])

  const orgDockerProviders = useMemo(() => {
    if (!providersMap) return []
    return Object.values(providersMap).filter((p) => p.type === EProvider.docker)
  }, [providersMap])

  const linkedDockerProviders = useMemo(() => {
    return dockerProviderIds
      .map((id) => orgDockerProviders.find((p) => p.id === id))
      .filter(Boolean) as Provider[]
  }, [dockerProviderIds, orgDockerProviders])

  const availableDockerProviders = useMemo(() => {
    const linked = new Set(dockerProviderIds)
    return orgDockerProviders.filter((p) => !linked.has(p.id))
  }, [orgDockerProviders, dockerProviderIds])

  const linkedProviders = useMemo(() => {
    return providerIds
      .map((id) => orgProviders.find((p) => p.id === id))
      .filter(Boolean) as Provider[]
  }, [providerIds, orgProviders])

  // Generative UI config override
  const [guiOverride, setGuiOverride] = useState(false)
  const [sandboxGuiConfig, setSandboxGuiConfig] = useState<TGuiConfig | undefined>(
    undefined
  )

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dockerDrawerOpen, setDockerDrawerOpen] = useState(false)
  const [aiProviderDrawerOpen, setAiProviderDrawerOpen] = useState(false)

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
    setProviderModels((prev) => {
      const updated = { ...prev }
      delete updated[providerId]
      return updated
    })
  }

  const applyPreset = (runtimeId: TSandboxRuntimeId) => {
    const preset = SandboxPresets[runtimeId]
    if (!preset) return

    setRuntime(runtimeId)

    if (runtimeId !== ESandboxRuntime.custom) {
      setImage(TDSK_SB_IMAGE_FULL)
      setRuntimeCommand(preset.config.runtimeCommand || ``)
      setInitScript(preset.config.initScript || ``)
      if (preset.config.idleTimeoutMinutes != null)
        setIdleTimeoutMinutes(preset.config.idleTimeoutMinutes)
      if (preset.config.resources?.limits?.cpu)
        setCpuLimit(preset.config.resources.limits.cpu)
      if (preset.config.resources?.limits?.memory)
        setMemoryLimit(preset.config.resources.limits.memory)
      if (preset.config.resources?.requests?.cpu)
        setCpuRequest(preset.config.resources.requests.cpu)
      if (preset.config.resources?.requests?.memory)
        setMemoryRequest(preset.config.resources.requests.memory)
    } else {
      setRuntimeCommand(``)
      setInitScript(``)
    }
  }

  const reset = () => {
    setName(``)
    setArgs(``)
    setImage(``)
    setAlias(``)
    setPorts([])
    setEnvVars([])
    setGitRepo(``)
    setWorkdir(``)
    setCommand(``)
    setError(null)
    setProviderIds([])
    setProviderModels({})
    setDockerProviderIds([])
    setCpuLimit(``)
    setCpuRequest(``)
    setMemoryLimit(``)
    setMemoryRequest(``)
    setGitBranch(`main`)
    setBaseSandboxId(null)
    setNewGitTokenValue(``)
    setGitTokenSecretId(``)
    setSelectedProjectIds([])
    setIdleTimeoutMinutes(30)
    setGitTokenMode(ESecretMode.none)
    setImagePullPolicy(EImagePullPolicy.IfNotPresent)
    setRuntime(ESandboxRuntime.claudeCode)
    setRuntimeCommand(``)
    setInitScript(``)
    setGuiOverride(false)
    setSandboxGuiConfig(undefined)
  }

  const populateFromSandbox = (source: Sandbox) => {
    const config = source.config ?? ({} as TKubeSandboxConfig)
    setNewGitTokenValue(``)
    setName(source.name || ``)
    setImage(config.image || ``)
    setWorkdir(config.workdir || ``)
    setGitRepo(config.gitRepo || ``)
    setArgs(config.args?.join(`, `) || ``)
    setGitBranch(config.gitBranch || `main`)
    setEnvVars(objToKV(config.envVars, `env`))
    setCommand(config.command?.join(`, `) || ``)
    setCpuLimit(config.resources?.limits?.cpu || ``)
    setCpuRequest(config.resources?.requests?.cpu || ``)
    setIdleTimeoutMinutes(config.idleTimeoutMinutes ?? 30)
    setMemoryLimit(config.resources?.limits?.memory || ``)
    setMemoryRequest(config.resources?.requests?.memory || ``)
    setImagePullPolicy(config.imagePullPolicy || EImagePullPolicy.IfNotPresent)
    setRuntime((config.runtime as TSandboxRuntimeId) || ESandboxRuntime.claudeCode)
    setRuntimeCommand(config.runtimeCommand || ``)
    setInitScript(config.initScript || ``)

    const allLinks = source.providerLinks || []
    setProviderIds(
      allLinks
        .filter((l) => l.provider.type !== EProvider.docker)
        .map((l) => l.provider.id)
    )
    setDockerProviderIds(
      allLinks
        .filter((l) => l.provider.type === EProvider.docker)
        .map((l) => l.provider.id)
    )
    const models: Record<string, string> = {}
    for (const link of allLinks) {
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

    if (projectId) {
      const pc = source.projectConfigs?.find((pc) => pc.projectId === projectId)
      setAlias(pc?.alias || ``)
    }

    if (config.guiConfig) {
      setGuiOverride(true)
      setSandboxGuiConfig(config.guiConfig)
    } else {
      setGuiOverride(false)
      setSandboxGuiConfig(undefined)
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

  useEffect(() => {
    if (sandbox) {
      populateFromSandbox(sandbox)
      setSelectedProjectIds(
        sandbox.projects?.map((p) => p.id) || (projectId ? [projectId] : [])
      )
    } else reset()
  }, [sandbox, projectId])

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
    if (gitTokenMode === ESecretMode.new && !newGitTokenValue.trim())
      return setError(`Secret value is required for new git auth token`)

    setLoading(true)
    setError(null)

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

    const portsObj: Record<string, TPortConfig> = {}
    for (const p of ports) {
      if (p.key.trim())
        portsObj[p.key.trim()] = { protocol: (p.value || 'http') as TProto }
    }

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
      providerInputs: [
        ...providerIds.map((id) => ({ id, model: providerModels[id] || null })),
        ...dockerProviderIds.map((id) => ({ id })),
      ],
      config: {
        runtime,
        idleTimeoutMinutes,
        image: image.trim(),
        imagePullPolicy: imagePullPolicy as TImagePullPolicy,
        ...(effectiveRuntimeCmd ? { runtimeCommand: effectiveRuntimeCmd } : {}),
        ...(effectiveInitScript ? { initScript: effectiveInitScript } : {}),
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
        ...(guiOverride && sandboxGuiConfig ? { guiConfig: sandboxGuiConfig } : {}),
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

  return {
    // Flags
    isEditMode,
    isProjectContext,
    isCustomRuntime,

    // Basic info
    name,
    setName,
    image,
    setImage,
    alias,
    setAlias,
    imagePullPolicy,
    setImagePullPolicy,

    // Container
    args,
    setArgs,
    workdir,
    setWorkdir,
    command,
    setCommand,

    // Runtime
    runtime,
    setRuntime,
    runtimeCommand,
    setRuntimeCommand,
    initScript,
    setInitScript,
    resolvedRuntimeCmd,
    resolvedInitScript,

    // Resources
    cpuLimit,
    setCpuLimit,
    cpuRequest,
    setCpuRequest,
    memoryLimit,
    setMemoryLimit,
    memoryRequest,
    setMemoryRequest,

    // Git
    gitRepo,
    setGitRepo,
    gitBranch,
    setGitBranch,
    gitTokenSecretId,
    setGitTokenSecretId,
    newGitTokenValue,
    setNewGitTokenValue,
    gitTokenMode,
    setGitTokenMode,

    // Config
    idleTimeoutMinutes,
    setIdleTimeoutMinutes,

    // Key-value editors
    envVars,
    setEnvVars,
    ports,
    setPorts,

    // Secrets
    allSecrets,
    secretOptions,

    // Projects
    orgProjects,
    selectedProjectIds,
    setSelectedProjectIds,
    projectSandboxList,
    baseSandboxId,
    onSelectBaseSandbox,

    // Providers
    providersMap,
    orgProviders,
    providerIds,
    setProviderIds,
    providerModels,
    setProviderModels,
    linkedProviders,
    availableProviders,
    onAddProvider,
    onRemoveProvider,
    compatibleBrands,

    // Docker providers
    orgDockerProviders,
    dockerProviderIds,
    setDockerProviderIds,
    linkedDockerProviders,
    availableDockerProviders,

    // Generative UI
    guiOverride,
    setGuiOverride,
    sandboxGuiConfig,
    setSandboxGuiConfig,

    // UI state
    loading,
    error,
    setError,
    dockerDrawerOpen,
    setDockerDrawerOpen,
    aiProviderDrawerOpen,
    setAiProviderDrawerOpen,

    // Actions
    applyPreset,
    onSave,
    onClose,
    actions,
  }
}
