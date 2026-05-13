import type { TKeyValuePair } from '@TAF/types'
import type { TAiProviderOption } from '@TAF/types/agent.types'
import type { Agent, TWebProviderBrand, TAgentProjectConfig } from '@tdsk/domain'

import { EProvider } from '@tdsk/domain'
import { Code } from '@TAF/components/Code'
import { useState, useEffect, useMemo } from 'react'
import { MonacoOptions } from '@TAF/constants/monaco'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
import { Box, Stack, Divider, Typography } from '@mui/material'
import { createAgent } from '@TAF/actions/agents/api/createAgent'
import { updateAgent } from '@TAF/actions/agents/api/updateAgent'
import { deleteAgent } from '@TAF/actions/agents/api/deleteAgent'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { upsertAgentConfig } from '@TAF/actions/agents/api/upsertAgentConfig'
import { Drawer, AutoInput, DrawerActions, ConfirmDelete } from '@tdsk/components'
import {
  useProviders,
  useProjects,
  useOrgSecrets,
  useProjectSecrets,
  useProjectFunctions,
} from '@TAF/state/selectors'
import {
  BasicInfoForm,
  ModelConfigForm,
  AgentSettingsForm,
  WebProviderSettings,
} from '@TAF/components/Agents'
import {
  ToolsSelector,
  SecretsSelector,
  FunctionsSelector,
} from '@TAF/components/Selectors'

export type TAgentDrawer = {
  open: boolean
  orgId: string
  projectId?: string
  agent: Agent | null
  onClose: () => void
  onSuccess?: () => void
}

export const AgentDrawer = (props: TAgentDrawer) => {
  const {
    open,
    agent,
    orgId,
    projectId,
    onClose: onCloseCB,
    onSuccess: onSuccessCB,
  } = props

  const isOverrideMode = !!projectId && !!agent

  // Jotai state selectors — replace local data-fetching useState+useEffect
  const [providersMap] = useProviders()
  const [projectsMap] = useProjects()
  const [orgSecretsMap] = useOrgSecrets()
  const [projectSecretsMap] = useProjectSecrets()
  const [functionsMap] = useProjectFunctions()

  const aiProviders = useMemo<TAiProviderOption[]>(() => {
    if (!providersMap) return []
    return Object.values(providersMap)
      .filter((p) => p.type === EProvider.ai)
      .map((p) => ({
        id: p.id,
        name: p.name || p.id,
        brand: p.brand || '',
        baseUrl: p.options?.baseUrl,
      }))
  }, [providersMap])

  const secretsList = useMemo(() => {
    const orgArr = Object.values(orgSecretsMap || {})
    const projArr = Object.values(projectSecretsMap || {})
    const merged = [...orgArr, ...projArr].filter((s) => s.id)
    const mergedIds = new Set(merged.map((s) => s.id))
    const agentOnly = (agent?.secrets || []).filter((s) => s.id && !mergedIds.has(s.id))
    return [...merged, ...agentOnly]
  }, [orgSecretsMap, projectSecretsMap, agent])

  const availableFunctions = useMemo(
    () => Object.values(functionsMap || {}),
    [functionsMap]
  )

  const orgProjects = useMemo(
    () => Object.values(projectsMap || {}).map((p) => ({ id: p.id, name: p.name })),
    [projectsMap]
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [selectedFunctionIds, setSelectedFunctionIds] = useState<string[]>([])

  // Form state
  const [name, setName] = useState('')
  const [active, setActive] = useState(true)
  const [streaming, setStreaming] = useState(true)
  const [maxTokens, setMaxTokens] = useState(100000)
  const [description, setDescription] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [envVars, setEnvVars] = useState<TKeyValuePair[]>([])
  const [providerIds, setProviderIds] = useState<string[]>([])
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [selectedSecrets, setSelectedSecrets] = useState<string[]>([])
  const [providerModels, setProviderModels] = useState<Record<string, string>>({})
  const [webProviderType, setWebProviderType] = useState<TWebProviderBrand | ''>('')
  const [webProviderSecretId, setWebProviderSecretId] = useState<string>('')

  // Pre-populate form with agent data when drawer opens
  useEffect(() => {
    if (agent) {
      setName(agent.name || '')
      setActive(agent.active ?? true)
      setSelectedTools(agent.tools || [])
      setDescription(agent.description || '')
      setProviderIds(agent.providers?.map((p) => p.id) || [])

      // Build providerModels from agent.providerLinks junction data
      const models: Record<string, string> = {}
      if (agent.providerLinks?.length) {
        for (const link of agent.providerLinks) {
          if (link.model) models[link.provider.id] = link.model
        }
      }
      setProviderModels(models)

      setMaxTokens(agent.maxTokens || 100000)
      setSystemPrompt(agent.systemPrompt || '')
      setStreaming(agent.environment?.streaming ?? true)
      setTemperature(agent.environment?.temperature ?? 0.7)

      // Convert envVars object to key-value pairs
      const envVarsPairs = Object.entries(agent.envVars || {}).map(
        ([key, value], idx) => ({
          id: `env-${idx}`,
          key,
          value,
        })
      )
      setEnvVars(envVarsPairs)

      // Set selected secrets
      setSelectedSecrets((agent.secrets || []).filter((s) => s.id).map((s) => s.id))

      // Set web provider config
      setWebProviderType(agent.environment?.webProvider?.type || '')
      setWebProviderSecretId(agent.environment?.webProvider?.secretId || '')

      const projectConfig = agent.getProjectConfig?.(projectId!)
      setSelectedFunctionIds(projectConfig?.functionIds || [])
      setSelectedProjectIds(
        agent.projects?.map((p) => p.id) || (projectId ? [projectId] : [])
      )
    } else {
      // Reset form for new agent
      setName(``)
      setEnvVars([])
      setActive(true)
      setDescription(``)
      setStreaming(true)
      setProviderIds([])
      setProviderModels({})
      setSystemPrompt(``)
      setTemperature(0.7)
      setMaxTokens(100000)
      setSelectedTools([])
      setSelectedSecrets([])
      setWebProviderType(``)
      setWebProviderSecretId(``)
      setSelectedFunctionIds([])
      setSelectedProjectIds(projectId ? [projectId] : [])
    }
    setError(null)
    setShowDeleteConfirm(false)
  }, [agent, open])

  const onClose = () => {
    !loading && onCloseCB?.()
  }

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!isOverrideMode && !providerIds.length)
      return setError(`At least one provider is required`)
    if (!isOverrideMode && !name.trim()) return setError(`Agent name is required`)

    try {
      setError(null)
      setLoading(true)

      const envVarsObj = envVars.reduce(
        (acc, pair) => {
          if (pair.key) acc[pair.key] = pair.value
          return acc
        },
        {} as Record<string, string>
      )

      const providerInputs = providerIds.map((id) => ({
        id,
        model: providerModels[id] || null,
      }))

      const buildEnvironment = () => ({
        streaming,
        temperature,
        ...(webProviderType
          ? {
              webProvider: {
                type: webProviderType,
                ...(webProviderSecretId ? { secretId: webProviderSecretId } : {}),
              },
            }
          : {}),
      })

      const agentData = {
        name,
        active,
        maxTokens,
        description,
        systemPrompt,
        providerInputs,
        envVars: envVarsObj,
        tools: selectedTools,
        secretIds: selectedSecrets,
        projectIds: selectedProjectIds,
        functionIds: selectedFunctionIds,
        environment: buildEnvironment(),
      }

      if (isOverrideMode) {
        const configData: Partial<TAgentProjectConfig> = {
          maxTokens,
          model: providerModels[providerIds[0]] || null,
          systemPrompt: systemPrompt || null,
          environment: buildEnvironment(),
          tools: selectedTools.length ? selectedTools : null,
          envVars: Object.keys(envVarsObj).length ? envVarsObj : null,
          functionIds: selectedFunctionIds.length ? selectedFunctionIds : null,
        }
        const result = await upsertAgentConfig({
          orgId,
          projectId: projectId!,
          agentId: agent!.id,
          data: configData,
        })
        if (result.error)
          return setError(result.error.message || `Failed to save agent config`)
      } else if (agent) {
        const result = await updateAgent({
          orgId,
          projectId,
          id: agent.id,
          data: agentData,
        })
        if (result.error)
          return setError(result.error.message || `Failed to update agent`)
      } else {
        const result = await createAgent({
          orgId,
          projectId,
          data: agentData,
        })
        if (result.error)
          return setError(result.error.message || `Failed to create agent`)
      }

      onSuccessCB?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to save agent`)
    } finally {
      setLoading(false)
    }
  }

  const onRemove = async () => {
    if (!agent) return

    try {
      setError(null)
      setLoading(true)
      await deleteAgent({ orgId, id: agent.id, projectId })
      onSuccessCB?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to delete agent`)
      setShowDeleteConfirm(false)
    } finally {
      setLoading(false)
    }
  }

  const title = isOverrideMode
    ? `Configure Agent for Project`
    : agent
      ? `Edit Agent`
      : `Create Agent`
  const { actions } = useDrawerActions({
    onSave,
    onClose,
    onRemove,
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <DrawerActions
          form='agent-form'
          editing={!!agent}
          actions={actions}
          loading={loading}
          disabled={loading || showDeleteConfirm}
        />
      }
    >
      <form id='agent-form'>
        <Stack spacing={3}>
          {error && (
            <ErrorAlert
              message={error}
              onClose={() => setError(null)}
            />
          )}

          {isOverrideMode && (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'info.main',
                color: 'info.contrastText',
              }}
            >
              <Typography
                variant='body2'
                fontWeight='medium'
              >
                Project Override Mode — Changes only affect this project. Identity fields
                (name, providers) are inherited from the org-level agent.
              </Typography>
            </Box>
          )}

          {showDeleteConfirm && (
            <ConfirmDelete
              deleting={loading}
              onConfirm={onRemove}
              itemName={agent?.name || 'Agent'}
              onCancel={() => setShowDeleteConfirm(false)}
            />
          )}

          <BasicInfoForm
            name={name}
            onNameChange={setName}
            providerIds={providerIds}
            aiProviders={aiProviders}
            description={description}
            providerModels={providerModels}
            onModelChange={setProviderModels}
            onProviderChange={setProviderIds}
            loading={loading || isOverrideMode}
            onDescriptionChange={setDescription}
          />

          {!isOverrideMode && (
            <>
              <Divider />

              <AutoInput
                id='agent-projects'
                disabled={loading}
                label='Project Assignment'
                value={selectedProjectIds}
                placeholder='Select projects...'
                onChange={setSelectedProjectIds}
                options={orgProjects.map((p) => ({ value: p.id, label: p.name }))}
              />
            </>
          )}

          <Divider />

          <ModelConfigForm
            loading={loading}
            maxTokens={maxTokens}
            temperature={temperature}
            onMaxTokensChange={setMaxTokens}
            onTemperatureChange={setTemperature}
          />

          <Divider />

          <Box>
            <Typography
              variant='subtitle2'
              sx={{ fontWeight: 600, mb: 2 }}
            >
              System Prompt
            </Typography>
            <Code
              id='system-prompt'
              disabled={loading}
              language='markdown'
              options={MonacoOptions}
              defaultValue={systemPrompt}
              label='Define the agent&apos;s behavior and role'
              onChange={(value) => setSystemPrompt(value || '')}
            />
          </Box>

          <Divider />

          <ToolsSelector
            loading={loading}
            onChange={setSelectedTools}
            selectedTools={selectedTools}
          />

          {projectId && (
            <>
              <Divider />

              <FunctionsSelector
                loading={loading}
                onChange={setSelectedFunctionIds}
                availableFunctions={availableFunctions}
                selectedFunctionIds={selectedFunctionIds}
              />
            </>
          )}

          <Divider />

          <KeyValueEditor
            pairs={envVars}
            disabled={loading}
            secrets={secretsList}
            onChange={setEnvVars}
            label='Environment Variables'
            enableSecretReferences={true}
            keyPlaceholder='Variable name'
            valuePlaceholder='Value or {{secret-name}}'
          />

          <Divider />

          <WebProviderSettings
            loading={loading}
            secretsList={secretsList}
            webProviderType={webProviderType}
            webProviderSecretId={webProviderSecretId}
            onWebProviderTypeChange={setWebProviderType}
            onWebProviderSecretIdChange={setWebProviderSecretId}
          />

          {!isOverrideMode && (
            <>
              <Divider />

              <SecretsSelector
                loading={loading}
                secretsList={secretsList}
                onChange={setSelectedSecrets}
                selectedSecrets={selectedSecrets}
              />
            </>
          )}

          <Divider />

          <AgentSettingsForm
            active={active}
            loading={loading}
            streaming={streaming}
            onActiveChange={setActive}
            onStreamingChange={setStreaming}
          />
        </Stack>
      </form>
    </Drawer>
  )
}
