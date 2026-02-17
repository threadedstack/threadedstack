import type { TKeyValuePair } from '@TAF/types'
import type { Agent, Secret, Function as TDFunction } from '@tdsk/domain'

import { useState, useEffect } from 'react'
import { Code } from '@TAF/components/Code'
import { useSecrets } from '@TAF/state/selectors'
import { MonacoOptions } from '@TAF/constants/monaco'
import { fetchProviders } from '@TAF/actions/providers'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
import { Box, Stack, Divider, Typography } from '@mui/material'
import { createAgent } from '@TAF/actions/agents/api/createAgent'
import { updateAgent } from '@TAF/actions/agents/api/updateAgent'
import { deleteAgent } from '@TAF/actions/agents/api/deleteAgent'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { fetchSecrets } from '@TAF/actions/secrets/api/fetchSecrets'
import { Drawer, DrawerActions, ConfirmDelete } from '@tdsk/components'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import {
  BasicInfoForm,
  ToolsSelector,
  SecretsSelector,
  ModelConfigForm,
  AgentSettingsForm,
} from '@TAF/components/Agents'

export type TAgentDrawer = {
  open: boolean
  agent: Agent | null
  orgId: string
  projectId: string
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

  const [secrets] = useSecrets()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [secretsList, setSecretsList] = useState<Secret[]>([])
  const [aiProviders, setAiProviders] = useState<Array<{ id: string; name: string }>>([])
  const [agentFunctions, setAgentFunctions] = useState<TDFunction[]>([])

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
      // Load secrets
      const secretsResult = await fetchSecrets({ orgId, projectId })
      if (secretsResult.data) setSecretsList(Object.values(secretsResult.data))

      // Load providers
      const providersResult = await fetchProviders({ orgId })
      if (providersResult.providers) {
        const aiProvidersOnly = Object.values(providersResult.providers)
          .filter((p) => p.type === 'ai')
          .map((p) => ({
            id: p.id,
            name: p.name || p.id,
          }))
        setAiProviders(aiProvidersOnly)
      }

      // Use functions already populated on the agent model
      setAgentFunctions(agent?.functions || [])
    }
    if (open && projectId) {
      loadData()
    }
  }, [open, projectId, orgId])

  // Pre-populate form with agent data when drawer opens
  useEffect(() => {
    if (agent) {
      setName(agent.name || '')
      setDescription(agent.description || '')
      setProviderId(agent.providerId || null)
      setSystemPrompt(agent.systemPrompt || '')
      setModel(agent.model || '')
      setMaxTokens(agent.maxTokens || 100000)
      setTemperature(agent.environment?.temperature || 0.7)
      setStreaming(agent.environment?.streaming ?? true)
      setActive(agent.active ?? true)
      setSelectedTools(agent.tools || [])

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
    } else {
      // Reset form for new agent
      setName('')
      setDescription('')
      setProviderId(null)
      setSystemPrompt('')
      setModel('')
      setMaxTokens(100000)
      setTemperature(0.7)
      setStreaming(true)
      setActive(true)
      setSelectedTools([])
      setEnvVars([])
      setSelectedSecrets([])
    }
    setError(null)
    setShowDeleteConfirm(false)
  }, [agent, open])

  const onClose = () => {
    !loading && onCloseCB?.()
  }

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!name.trim()) return setError(`Agent name is required`)
    if (!providerId) return setError(`Provider is required`)

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

          {agentFunctions.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography
                  variant='subtitle2'
                  sx={{ fontWeight: 600, mb: 2 }}
                >
                  Custom Functions
                </Typography>
                <Typography
                  variant='body2'
                  color='text.secondary'
                  sx={{ mb: 1 }}
                >
                  Functions attached to this agent as tools. Manage in the Functions
                  section.
                </Typography>
                {agentFunctions.map((fn) => (
                  <Box
                    key={fn.id}
                    sx={{
                      p: 1.5,
                      mb: 1,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      variant='body2'
                      sx={{ fontWeight: 500 }}
                    >
                      {fn.name}
                    </Typography>
                    {fn.description && (
                      <Typography
                        variant='caption'
                        color='text.secondary'
                      >
                        {fn.description}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
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
