import type { TKeyValuePair } from '@TAF/types'
import type { Agent, Secret, Function as FunctionModel } from '@tdsk/domain'

import { useState, useEffect } from 'react'
import { cls } from '@keg-hub/jsutils/cls'
import { Code } from '@TAF/components/Code'
import { MonacoOptions } from '@TAF/constants/monaco'
import { fetchProviders } from '@TAF/actions/providers'
import { fetchFunctions } from '@TAF/actions/functions'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
import { useSecrets, useOrgSecrets } from '@TAF/state/selectors'
import { createAgent } from '@TAF/actions/agents/api/createAgent'
import { updateAgent } from '@TAF/actions/agents/api/updateAgent'
import { deleteAgent } from '@TAF/actions/agents/api/deleteAgent'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { fetchSecrets } from '@TAF/actions/secrets/api/fetchSecrets'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { Box, Stack, Divider, Typography, Autocomplete } from '@mui/material'
import {
  Drawer,
  DrawerActions,
  ConfirmDelete,
  AutoInputText,
  InputStateHandler,
} from '@tdsk/components'
import {
  BasicInfoForm,
  ToolsSelector,
  SecretsSelector,
  ModelConfigForm,
  AgentSettingsForm,
} from '@TAF/components/Agents'

export type TAgentDrawer = {
  open: boolean
  orgId: string
  projectId: string
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

  // TODO: Secrets list should come form the jotai store
  const [secrets] = useSecrets()
  const [orgSecrets] = useOrgSecrets()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [secretsList, setSecretsList] = useState<Secret[]>([])
  const [aiProviders, setAiProviders] = useState<Array<{ id: string; name: string }>>([])
  const [availableFunctions, setAvailableFunctions] = useState<FunctionModel[]>([])
  const [selectedFunctionIds, setSelectedFunctionIds] = useState<string[]>([])

  // Form state
  const [name, setName] = useState('')
  const [model, setModel] = useState('')
  const [active, setActive] = useState(true)
  const [streaming, setStreaming] = useState(true)
  const [maxTokens, setMaxTokens] = useState(100000)
  const [description, setDescription] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [envVars, setEnvVars] = useState<TKeyValuePair[]>([])
  const [providerId, setProviderId] = useState<string | null>(null)
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [selectedSecrets, setSelectedSecrets] = useState<string[]>([])

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

      setSecretsList([
        ...(orgSecretsResult.data || []),
        ...(projectSecretsResult.data || []),
      ])

      // Load providers
      const providersResult = await fetchProviders({ orgId })
      if (providersResult.providers) {
        const aiProvidersOnly = Object.values(providersResult.providers)
          .filter((p) => p.type === `ai`)
          .map((p) => ({
            id: p.id,
            name: p.name || p.id,
          }))
        setAiProviders(aiProvidersOnly)
      }

      // Load functions for the project
      const functionsResult = await fetchFunctions({ orgId, projectId })
      functionsResult?.functions &&
        setAvailableFunctions(Object.values(functionsResult.functions))
    }

    open && projectId && loadData()
  }, [open, orgId, projectId])

  // Pre-populate form with agent data when drawer opens
  useEffect(() => {
    if (agent) {
      setName(agent.name || '')
      setModel(agent.model || '')
      setActive(agent.active ?? true)
      setSelectedTools(agent.tools || [])
      setDescription(agent.description || '')
      setProviderId(agent.providerId || null)
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
      setSelectedSecrets(
        (agent.secrets || []).map((s) => s.id || s.name || s.hashKey || '')
      )
      setSelectedFunctionIds((agent.functions || []).map((f) => f.id))
    } else {
      // Reset form for new agent
      setName('')
      setModel('')
      setEnvVars([])
      setActive(true)
      setDescription('')
      setStreaming(true)
      setProviderId(null)
      setSystemPrompt('')
      setTemperature(0.7)
      setMaxTokens(100000)
      setSelectedTools([])
      setSelectedSecrets([])
      setSelectedFunctionIds([])
    }
    setError(null)
    setShowDeleteConfirm(false)
  }, [agent, open])

  const onClose = () => {
    !loading && onCloseCB?.()
  }

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!providerId) return setError(`Provider is required`)
    if (!name.trim()) return setError(`Agent name is required`)

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

      const agentData = {
        name,
        model,
        active,
        maxTokens,
        providerId,
        description,
        systemPrompt,
        envVars: envVarsObj,
        tools: selectedTools,
        functionIds: selectedFunctionIds,
        environment: { streaming, temperature },
        secrets: selectedSecrets
          .map((secretId) =>
            secretsList.find((s) => s.id === secretId || s.name === secretId)
          )
          .filter(Boolean) as Secret[],
      }

      agent
        ? await updateAgent({
            orgId,
            projectId,
            id: agent.id,
            data: agentData,
          })
        : await createAgent({
            orgId,
            projectId,
            data: agentData,
          })

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

  const title = agent ? `Edit Agent` : `Create Agent`
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
            loading={loading}
            onNameChange={setName}
            providerId={providerId}
            aiProviders={aiProviders}
            description={description}
            onProviderChange={setProviderId}
            onDescriptionChange={setDescription}
          />

          <Divider />

          <ModelConfigForm
            model={model}
            loading={loading}
            maxTokens={maxTokens}
            onModelChange={setModel}
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

          <Divider />

          <InputStateHandler
            id='agent-functions'
            label='Custom Functions'
            disabled={loading || availableFunctions.length === 0}
            description={
              loading
                ? `Loading functions...`
                : availableFunctions.length === 0
                  ? `No functions available. Create a function first.`
                  : `Select functions to attach as tools for this agent`
            }
          >
            <Autocomplete
              multiple
              id='agent-functions'
              className={cls(`tdsk-auto-input`, loading && `disabled`)}
              value={selectedFunctionIds}
              options={availableFunctions.map((f) => f.id)}
              getOptionLabel={(id) =>
                availableFunctions.find((f) => f.id === id)?.name || id
              }
              onChange={(_, updates) => setSelectedFunctionIds(updates)}
              disabled={loading || availableFunctions.length === 0}
              renderInput={(params) => (
                <AutoInputText
                  {...params}
                  sx={{ padding: `0px` }}
                  placeholder='Select functions...'
                />
              )}
            />
          </InputStateHandler>

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

          <SecretsSelector
            loading={loading}
            secretsList={secretsList}
            onChange={setSelectedSecrets}
            selectedSecrets={selectedSecrets}
          />

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
