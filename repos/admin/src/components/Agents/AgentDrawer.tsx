import type { TKeyValuePair } from '@TAF/types'
import type { TAiProviderOption } from '@TAF/types/agent.types'
import type {
  Agent,
  Secret,
  TAgentProjectConfig,
  TWebProviderBrand,
  Function as FunctionModel,
} from '@tdsk/domain'

import { useState, useEffect } from 'react'
import { Code } from '@TAF/components/Code'
import { MonacoOptions } from '@TAF/constants/monaco'
import { fetchProviders } from '@TAF/actions/providers'
import { fetchFunctions } from '@TAF/actions/functions'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
import { createAgent } from '@TAF/actions/agents/api/createAgent'
import { updateAgent } from '@TAF/actions/agents/api/updateAgent'
import { deleteAgent } from '@TAF/actions/agents/api/deleteAgent'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { fetchSecrets } from '@TAF/actions/secrets/api/fetchSecrets'
import { Drawer, DrawerActions, ConfirmDelete } from '@tdsk/components'
import { fetchProjects } from '@TAF/actions/projects/api/fetchProjects'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { upsertAgentConfig } from '@TAF/actions/agents/api/upsertAgentConfig'
import { Autocomplete, Box, Stack, Divider, TextField, Typography } from '@mui/material'
import {
  WebProviderSettings,
  BasicInfoForm,
  ModelConfigForm,
  AgentSettingsForm,
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

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [secretsList, setSecretsList] = useState<Secret[]>([])
  const [aiProviders, setAiProviders] = useState<TAiProviderOption[]>([])
  const [availableFunctions, setAvailableFunctions] = useState<FunctionModel[]>([])
  const [selectedFunctionIds, setSelectedFunctionIds] = useState<string[]>([])
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [orgProjects, setOrgProjects] = useState<Array<{ id: string; name: string }>>([])

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
  const [providerModels, setProviderModels] = useState<Record<string, string>>({})
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [selectedSecrets, setSelectedSecrets] = useState<string[]>([])
  const [webProviderType, setWebProviderType] = useState<TWebProviderBrand | ''>('')
  const [webProviderSecretId, setWebProviderSecretId] = useState<string>('')

  // Load secrets and providers for the project
  useEffect(() => {
    const loadData = async () => {
      // TODO: Secrets list should come form the jotai store
      // Not from the action responses
      // Load secrets - both org-level and project-level
      const [orgSecretsResult, projectSecretsResult] = await Promise.all([
        fetchSecrets({ orgId }),
        fetchSecrets({ orgId, projectId }),
      ])

      if (orgSecretsResult.error)
        console.warn('[AgentDrawer] Failed to load org secrets:', orgSecretsResult.error)
      if (projectSecretsResult.error)
        console.warn(
          '[AgentDrawer] Failed to load project secrets:',
          projectSecretsResult.error
        )

      // Merge org + project secrets, then add agent's own secrets (dedup by ID)
      const fetched = [
        ...(orgSecretsResult.data || []),
        ...(projectSecretsResult.data || []),
      ].filter((s) => s.id)
      const fetchedIds = new Set(fetched.map((s) => s.id))
      const agentOnly = (agent?.secrets || []).filter(
        (s) => s.id && !fetchedIds.has(s.id)
      )
      setSecretsList([...fetched, ...agentOnly])

      // Load providers
      const providersResult = await fetchProviders({ orgId })
      if (providersResult.error)
        console.warn('[AgentDrawer] Failed to load providers:', providersResult.error)
      if (providersResult.data) {
        const aiProvidersOnly = providersResult.data
          .filter((p) => p.type === `ai`)
          .map((p) => ({
            id: p.id,
            name: p.name || p.id,
            brand: p.brand || '',
          }))
        setAiProviders(aiProvidersOnly)
      }

      // Load functions for the project or agent's first linked project
      const effectiveProjectId = projectId || agent?.projects?.[0]?.id
      if (effectiveProjectId) {
        const functionsResult = await fetchFunctions({
          orgId,
          projectId: effectiveProjectId,
        })
        if (functionsResult?.error) {
          setError(`Failed to load functions`)
          console.warn(`[AgentDrawer] Failed to load functions:`, functionsResult.error)
        }
        functionsResult?.data && setAvailableFunctions(functionsResult.data)
      }

      // Load org projects for project assignment
      const projectsResp = await fetchProjects({ orgId })
      if (projectsResp?.error) {
        setError(`Failed to load projects`)
        console.warn(`[AgentDrawer] Failed to load projects:`, projectsResp.error)
      }
      projectsResp?.data &&
        setOrgProjects(
          Object.values(projectsResp.data).map((p) => ({ id: p.id, name: p.name }))
        )
    }

    open &&
      orgId &&
      loadData().catch((err) => {
        console.warn('[AgentDrawer] Unexpected error loading data:', err)
        setError('Failed to load drawer data. Please close and try again.')
      })
  }, [open, orgId, projectId, agent])

  // Pre-populate form with agent data when drawer opens
  useEffect(() => {
    if (agent) {
      setName(agent.name || '')
      setActive(agent.active ?? true)
      setSelectedTools(agent.tools || [])
      setDescription(agent.description || '')
      setProviderIds(agent.providers?.map((p) => p.id) || [])

      // Build providerModels from agent.agentProviders junction data
      const models: Record<string, string> = {}
      if (agent.agentProviders?.length) {
        for (const ap of agent.agentProviders) {
          if (ap.model) models[ap.provider.id] = ap.model
        }
      }
      // Backward compat: if no per-provider models but agent.model exists, assign to primary
      if (!Object.keys(models).length && agent.model && agent.providers?.[0]) {
        models[agent.providers[0].id] = agent.model
      }
      setProviderModels(models)

      // Seed aiProviders from agent data to avoid empty tag flash before async fetch
      if (agent.providers?.length) {
        setAiProviders((prev) =>
          prev?.length
            ? prev
            : agent
                .providers!.filter((p: any) => p.type === 'ai')
                .map((p: any) => ({
                  id: p.id,
                  name: p.name || p.id,
                  brand: p.brand || '',
                }))
        )
      }
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
      setName('')
      setEnvVars([])
      setActive(true)
      setDescription('')
      setStreaming(true)
      setProviderIds([])
      setProviderModels({})
      setSystemPrompt('')
      setTemperature(0.7)
      setMaxTokens(100000)
      setSelectedTools([])
      setSelectedSecrets([])
      setWebProviderType('')
      setWebProviderSecretId('')
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

      // Build providers array with per-provider models
      const providers = providerIds.map((id, i) => ({
        id,
        priority: i,
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
        providers,
        description,
        systemPrompt,
        envVars: envVarsObj,
        tools: selectedTools,
        projectIds: selectedProjectIds,
        functionIds: selectedFunctionIds,
        environment: buildEnvironment(),
        secretIds: selectedSecrets,
        // Backward compat: keep model on agent for fallback
        model: providerModels[providerIds[0]] || '',
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
            loading={loading || isOverrideMode}
            onNameChange={setName}
            providerIds={providerIds}
            aiProviders={aiProviders}
            description={description}
            providerModels={providerModels}
            onModelChange={setProviderModels}
            onProviderChange={setProviderIds}
            onDescriptionChange={setDescription}
          />

          {!isOverrideMode && (
            <>
              <Divider />

              <Box>
                <Typography
                  variant='subtitle2'
                  sx={{ fontWeight: 600, mb: 2 }}
                >
                  Project Assignment
                </Typography>
                <Autocomplete
                  multiple
                  id='agent-projects'
                  value={selectedProjectIds}
                  options={orgProjects.map((p) => p.id)}
                  getOptionLabel={(id) =>
                    orgProjects.find((p) => p.id === id)?.name || id
                  }
                  onChange={(_, updates) => setSelectedProjectIds(updates)}
                  disabled={loading}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder='Select projects...'
                      size='small'
                    />
                  )}
                />
              </Box>
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
                selectedFunctionIds={selectedFunctionIds}
                availableFunctions={availableFunctions}
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
