import type { Agent, Secret } from '@tdsk/domain'
import type { TKeyValuePair } from '@TAF/types'

import { useState, useEffect } from 'react'
import { Code } from '@TAF/components/Code'
import { useSecrets } from '@TAF/state/selectors'
import { fetchSecrets } from '@TAF/actions/secrets'
import { MonacoOptions } from '@TAF/constants/monaco'
import { fetchProviders } from '@TAF/actions/providers'
import { Drawer, ConfirmDelete } from '@tdsk/components'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
import { createAgent } from '@TAF/actions/agents/api/createAgent'
import { updateAgent } from '@TAF/actions/agents/api/updateAgent'
import { deleteAgent } from '@TAF/actions/agents/api/deleteAgent'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'
import {
  BasicInfoForm,
  ToolsSelector,
  SecretsSelector,
  ModelConfigForm,
  AgentSettingsForm,
} from '@TAF/components/Agents'
import { Box, Stack, Button, Divider, Typography } from '@mui/material'

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
      const secretsResult = await fetchSecrets({ projectId })
      if (secretsResult.secrets) {
        setSecretsList(Object.values(secretsResult.secrets))
      }

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
    if (!loading) {
      onCloseCB?.()
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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
        projectId,
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

      agent ? await updateAgent(agent.id, agentData) : await createAgent(agentData)

      onSuccessCB?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to save agent`)
    } finally {
      setLoading(false)
    }
  }

  const onDelete = async () => {
    if (!agent) return

    try {
      setError(null)
      setLoading(true)
      await deleteAgent(agent.id)
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
  const isEditing = !!agent

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      actionsSx={{ justifyContent: `space-between`, px: 3, pb: 2 }}
      actions={
        <>
          {isEditing && (
            <Button
              color='error'
              disabled={loading || showDeleteConfirm}
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete
            </Button>
          )}
          {!isEditing && <div />}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <LoadingButton
              type='submit'
              form='agent-form'
              variant='contained'
              loading={loading}
              disabled={showDeleteConfirm}
              loadingText='Saving...'
            >
              {isEditing ? `Save Changes` : `Create Agent`}
            </LoadingButton>
          </Box>
        </>
      }
    >
      <form
        id='agent-form'
        onSubmit={onSubmit}
      >
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
              onConfirm={onDelete}
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
