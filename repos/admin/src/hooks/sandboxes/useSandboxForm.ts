import type { TKeyValuePair } from '@TAF/types'
import type {
  TProto,
  Sandbox,
  Provider,
  TPortConfig,
  TGuiConfig,
  TImagePullPolicy,
  TKubeSandboxConfig,
  TSandboxRuntimeId,
} from '@tdsk/domain'

import { useState, useEffect, useMemo } from 'react'
import { TDSK_SB_IMAGE_FULL } from '@TAF/constants/envs'
import { kvToObj, objToKV } from '@TAF/utils/transforms/kvs'
import { createSandbox, updateSandbox } from '@TAF/actions/sandboxes'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import {
  EProvider,
  SandboxPresets,
  ESandboxRuntime,
  EImagePullPolicy,
  SandboxRuntimeConfigs,
  RuntimeProviderEnvMap,
} from '@tdsk/domain'
import {
  useSkills,
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
  const [initScript, setInitScript] = useState(``)
  const [runtimeCommand, setRuntimeCommand] = useState(``)
  const [runtime, setRuntime] = useState<TSandboxRuntimeId>(ESandboxRuntime.claudeCode)

  // Resources
  const [cpuLimit, setCpuLimit] = useState(``)
  const [cpuRequest, setCpuRequest] = useState(``)
  const [memoryLimit, setMemoryLimit] = useState(``)
  const [memoryRequest, setMemoryRequest] = useState(``)

  // Config extras
  const [maxInstances, setMaxInstances] = useState(1)
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
  const [gitProviderIds, setGitProviderIds] = useState<string[]>([])
  const [dockerProviderIds, setDockerProviderIds] = useState<string[]>([])
  const [providerModels, setProviderModels] = useState<Record<string, string>>({})
  const [gitBranchOverrides, setGitBranchOverrides] = useState<Record<string, string>>({})

  const orgProviders = useMemo(() => {
    if (!providersMap) return []
    return Object.values(providersMap).filter((p) => p.type === `ai`)
  }, [providersMap])

  const orgDockerProviders = useMemo(() => {
    if (!providersMap) return []
    return Object.values(providersMap).filter((p) => p.type === EProvider.docker)
  }, [providersMap])

  const orgGitProviders = useMemo(() => {
    if (!providersMap) return []
    return Object.values(providersMap).filter((p) => p.type === EProvider.git)
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

  const linkedGitProviders = useMemo(() => {
    return gitProviderIds
      .map((id) => orgGitProviders.find((p) => p.id === id))
      .filter(Boolean) as Provider[]
  }, [gitProviderIds, orgGitProviders])

  const availableGitProviders = useMemo(() => {
    const linked = new Set(gitProviderIds)
    return orgGitProviders.filter((p) => !linked.has(p.id))
  }, [orgGitProviders, gitProviderIds])

  const linkedProviders = useMemo(() => {
    return providerIds
      .map((id) => orgProviders.find((p) => p.id === id))
      .filter(Boolean) as Provider[]
  }, [providerIds, orgProviders])

  // Skills
  const [skillsMap] = useSkills()
  const [skillIds, setSkillIds] = useState<string[]>([])
  const [projectSkillIds, setProjectSkillIds] = useState<string[]>([])

  const orgSkillsList = useMemo(() => Object.values(skillsMap || {}), [skillsMap])

  const linkedOrgSkills = useMemo(() => {
    return skillIds
      .map((id) => orgSkillsList.find((s) => s.id === id))
      .filter(Boolean)
      .map((s) => ({
        id: s!.id,
        name: s!.name,
        description: s!.description,
        alwaysActive: s!.alwaysActive,
      }))
  }, [skillIds, orgSkillsList])

  const linkedProjectSkills = useMemo(() => {
    return projectSkillIds
      .map((id) => orgSkillsList.find((s) => s.id === id))
      .filter(Boolean)
      .map((s) => ({
        id: s!.id,
        name: s!.name,
        description: s!.description,
        alwaysActive: s!.alwaysActive,
      }))
  }, [projectSkillIds, orgSkillsList])

  const availableSkills = useMemo(() => {
    const assigned = new Set([...skillIds, ...projectSkillIds])
    return orgSkillsList
      .filter((s) => !assigned.has(s.id))
      .map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        alwaysActive: s.alwaysActive,
      }))
  }, [orgSkillsList, skillIds, projectSkillIds])

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
    setWorkdir(``)
    setCommand(``)
    setError(null)
    setProviderIds([])
    setProviderModels({})
    setDockerProviderIds([])
    setGitProviderIds([])
    setGitBranchOverrides({})
    setCpuLimit(``)
    setCpuRequest(``)
    setMemoryLimit(``)
    setMemoryRequest(``)
    setSkillIds([])
    setProjectSkillIds([])
    setBaseSandboxId(null)
    setSelectedProjectIds([])
    setIdleTimeoutMinutes(30)
    setMaxInstances(1)
    setImagePullPolicy(EImagePullPolicy.IfNotPresent)
    setRuntime(ESandboxRuntime.claudeCode)
    setRuntimeCommand(``)
    setInitScript(``)
    setGuiOverride(false)
    setSandboxGuiConfig(undefined)
  }

  const populateFromSandbox = (source: Sandbox) => {
    const config = source.config ?? ({} as TKubeSandboxConfig)
    setName(source.name || ``)
    setImage(config.image || ``)
    setWorkdir(config.workdir || ``)
    setArgs(config.args?.join(`, `) || ``)
    setEnvVars(objToKV(config.envVars, `env`))
    setCommand(config.command?.join(`, `) || ``)
    setCpuLimit(config.resources?.limits?.cpu || ``)
    setCpuRequest(config.resources?.requests?.cpu || ``)
    setIdleTimeoutMinutes(config.idleTimeoutMinutes ?? 30)
    setMaxInstances(config.maxInstances ?? 1)
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

    const gitLinks = (source.gitProviderLinks || []).filter(
      (l) => l.projectId === projectId
    )
    setGitProviderIds(gitLinks.map((l) => l.provider.id))
    const branches: Record<string, string> = {}
    for (const l of gitLinks) {
      if (l.branch) branches[l.provider.id] = l.branch
    }
    setGitBranchOverrides(branches)

    const models: Record<string, string> = {}
    for (const link of allLinks) {
      if (link.model) models[link.provider.id] = link.model
    }
    setProviderModels(models)

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

    const skillLinksData = (source as any).skillLinks || []
    setSkillIds(
      skillLinksData
        .filter((l: any) => !l.projectId)
        .map((l: any) => l.skillId || l.skill?.id)
        .filter(Boolean)
    )
    if (projectId) {
      setProjectSkillIds(
        skillLinksData
          .filter((l: any) => l.projectId === projectId)
          .map((l: any) => l.skillId || l.skill?.id)
          .filter(Boolean)
      )
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

    const commandArr = splitCSV(command)
    const argsArr = splitCSV(args)
    const envVarsObj = kvToObj(envVars, false)

    const effectiveRuntimeCmd = isCustomRuntime ? runtimeCommand : resolvedRuntimeCmd
    const effectiveInitScript = isCustomRuntime
      ? initScript
      : initScript || resolvedInitScript

    const skillInputs = [
      ...skillIds.map((id) => ({ id })),
      ...(projectId ? projectSkillIds.map((id) => ({ id, projectId })) : []),
    ]

    const sandboxData = {
      name: name.trim(),
      ...(!isProjectContext && { projectIds: selectedProjectIds }),
      ...(skillInputs.length ? { skillInputs } : {}),
      providerInputs: [
        ...providerIds.map((id) => ({ id, model: providerModels[id] || null })),
        ...dockerProviderIds.map((id) => ({ id })),
      ],
      ...(projectId
        ? {
            gitProviderInputs: [
              {
                projectId,
                providers: gitProviderIds.map((id) => ({
                  id,
                  branch: gitBranchOverrides[id] || null,
                })),
              },
            ],
          }
        : {}),
      config: {
        runtime,
        maxInstances,
        idleTimeoutMinutes,
        image: image.trim(),
        imagePullPolicy: imagePullPolicy as TImagePullPolicy,
        ...(effectiveRuntimeCmd ? { runtimeCommand: effectiveRuntimeCmd } : {}),
        ...(effectiveInitScript ? { initScript: effectiveInitScript } : {}),
        ...(argsArr.length > 0 ? { args: argsArr } : {}),
        ...(workdir.trim() ? { workdir: workdir.trim() } : {}),
        ...(commandArr.length > 0 ? { command: commandArr } : {}),
        ...(Object.keys(resources).length > 0 ? { resources } : {}),
        ...(Object.keys(portsObj).length > 0 ? { ports: portsObj } : {}),
        ...(Object.keys(envVarsObj).length > 0 ? { envVars: envVarsObj } : {}),
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
    image,
    alias,
    setName,
    setAlias,
    setImage,
    imagePullPolicy,
    setImagePullPolicy,

    // Container
    args,
    setArgs,
    workdir,
    command,
    setWorkdir,
    setCommand,

    // Runtime
    runtime,
    setRuntime,
    initScript,
    setInitScript,
    runtimeCommand,
    setRuntimeCommand,
    resolvedRuntimeCmd,
    resolvedInitScript,

    // Resources
    cpuLimit,
    cpuRequest,
    setCpuLimit,
    memoryLimit,
    setCpuRequest,
    setMemoryLimit,
    memoryRequest,
    setMemoryRequest,

    // Config
    maxInstances,
    setMaxInstances,
    idleTimeoutMinutes,
    setIdleTimeoutMinutes,

    // Key-value editors
    ports,
    envVars,
    setPorts,
    setEnvVars,

    // Secrets
    allSecrets,
    secretOptions,

    // Projects
    orgProjects,
    baseSandboxId,
    projectSandboxList,
    selectedProjectIds,
    onSelectBaseSandbox,
    setSelectedProjectIds,

    // Providers
    providerIds,
    providersMap,
    orgProviders,
    onAddProvider,
    setProviderIds,
    providerModels,
    linkedProviders,
    onRemoveProvider,
    compatibleBrands,
    setProviderModels,
    availableProviders,

    // Docker providers
    dockerProviderIds,
    orgDockerProviders,
    setDockerProviderIds,
    linkedDockerProviders,
    availableDockerProviders,

    // Git providers
    gitProviderIds,
    orgGitProviders,
    setGitProviderIds,
    linkedGitProviders,
    gitBranchOverrides,
    setGitBranchOverrides,
    availableGitProviders,

    // Skills
    skillIds,
    setSkillIds,
    linkedOrgSkills,
    availableSkills,
    projectSkillIds,
    setProjectSkillIds,
    linkedProjectSkills,

    // Generative UI
    guiOverride,
    setGuiOverride,
    sandboxGuiConfig,
    setSandboxGuiConfig,

    // UI state
    error,
    loading,
    setError,
    dockerDrawerOpen,
    setDockerDrawerOpen,
    aiProviderDrawerOpen,
    setAiProviderDrawerOpen,

    // Actions
    onSave,
    onClose,
    actions,
    applyPreset,
  }
}
