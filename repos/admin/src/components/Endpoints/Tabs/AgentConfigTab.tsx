import type { TKeyValuePair } from '@TAF/types'
import type { TAgentEndpointConfig, TWebProviderBrand } from '@tdsk/domain'
import type { TAiProviderOption } from '@TAF/types/agent.types'

import { toast } from 'sonner'
import { Code } from '@TAF/components/Code'
import SaveIcon from '@mui/icons-material/Save'
import { MonacoOptions } from '@TAF/constants/monaco'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
import { AgentSection } from '@TAF/components/Agents/AgentSection'
import { updateAgent } from '@TAF/actions/agents/api/updateAgent'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { updateEndpoint } from '@TAF/actions/endpoints/api/updateEndpoint'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'
import { EndpointAgent } from '@TAF/components/Endpoints/Agent/EndpointAgent'
import { useUnsavedChangesGuard } from '@TAF/hooks/endpoints/useUnsavedChangesGuard'
import {
  Box,
  Stack,
  Dialog,
  Button,
  Divider,
  Typography,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
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
import {
  useProviders,
  useActiveOrgId,
  useProjectAgents,
  useProjectSecrets,
  useActiveEndpoint,
  useActiveProjectId,
  useProjectFunctions,
  useAgentFormState as useAgentFormStateSelector,
} from '@TAF/state/selectors'

export const AgentConfigTab = () => {
  const [endpoint] = useActiveEndpoint()
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  const [secretsMap] = useProjectSecrets()
  const [providersMap] = useProviders()
  const [agentsMap] = useProjectAgents()
  const [functionsMap] = useProjectFunctions()
  const [agentFormState] = useAgentFormStateSelector()

  const configRef = useRef<TAgentEndpointConfig | null>(null)
  const validationErrorRef = useRef<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const configInitializedRef = useRef(false)

  // Agent editor state
  const [agentName, setAgentName] = useState(``)
  const [agentActive, setAgentActive] = useState(true)
  const [agentStreaming, setAgentStreaming] = useState(true)
  const [agentDescription, setAgentDescription] = useState(``)
  const [agentMaxTokens, setAgentMaxTokens] = useState(100000)
  const [agentTemperature, setAgentTemperature] = useState(0.7)
  const [agentSystemPrompt, setAgentSystemPrompt] = useState(``)
  const [agentEnvVars, setAgentEnvVars] = useState<TKeyValuePair[]>([])
  const [agentProviderIds, setAgentProviderIds] = useState<string[]>([])
  const [aiProviders, setAiProviders] = useState<TAiProviderOption[]>([])
  const [agentSelectedTools, setAgentSelectedTools] = useState<string[]>([])
  const [agentWebProviderSecretId, setAgentWebProviderSecretId] = useState(``)
  const [agentSelectedSecrets, setAgentSelectedSecrets] = useState<string[]>([])
  const [agentSelectedFunctionIds, setAgentSelectedFunctionIds] = useState<string[]>([])
  const [agentProviderModels, setAgentProviderModels] = useState<Record<string, string>>(
    {}
  )
  const [agentWebProviderType, setAgentWebProviderType] = useState<
    TWebProviderBrand | ``
  >(``)

  // Track which agent is loaded in the editor to avoid re-initializing on every render
  const loadedAgentIdRef = useRef<string | null>(null)

  // Reset dirty state when endpoint changes
  useEffect(() => {
    setIsDirty(false)
    configInitializedRef.current = false
  }, [endpoint?.id])

  const availableSecrets = useMemo(
    () => (secretsMap ? Object.values(secretsMap) : []),
    [secretsMap]
  )

  const availableAgents = useMemo(
    () => (agentsMap ? Object.values(agentsMap) : []),
    [agentsMap]
  )

  const availableProviders = useMemo(
    () => (providersMap ? Object.values(providersMap) : []),
    [providersMap]
  )

  const availableFunctions = useMemo(
    () => (functionsMap ? Object.values(functionsMap) : []),
    [functionsMap]
  )

  // The selected agent ID comes from the endpoint agent form state
  const selectedAgentId = agentFormState?.agentId || ''

  const selectedAgent = useMemo(() => {
    if (!selectedAgentId || !agentsMap) return null
    return agentsMap[selectedAgentId] || null
  }, [selectedAgentId, agentsMap])

  const hasChanges = useMemo(() => {
    if (isDirty) return true
    if (!selectedAgent) return false

    return (
      agentName !== (selectedAgent.name || '') ||
      agentDescription !== (selectedAgent.description || '') ||
      agentActive !== (selectedAgent.active ?? true) ||
      agentMaxTokens !== (selectedAgent.maxTokens || 100000) ||
      agentSystemPrompt !== (selectedAgent.systemPrompt || '')
    )
  }, [
    isDirty,
    agentName,
    agentActive,
    selectedAgent,
    agentMaxTokens,
    agentDescription,
    agentSystemPrompt,
  ])

  const { showDialog, onConfirmLeave, onCancelLeave } = useUnsavedChangesGuard(hasChanges)

  // Build AI providers list from the store for the agent editor
  useEffect(() => {
    if (providersMap) {
      const aiOnly = Object.values(providersMap)
        .filter((p) => p.type === 'ai')
        .map((p) => ({
          id: p.id,
          name: p.name || p.id,
          brand: p.brand || '',
        }))
      setAiProviders(aiOnly)
    }
  }, [providersMap])

  // Merge secrets lists: project secrets + agent's own secrets (for SecretsSelector)
  const agentSecretsList = useMemo(() => {
    const base = availableSecrets
    if (!selectedAgent?.secrets?.length) return base
    const baseIds = new Set(base.map((s) => s.id))
    const agentOnly = selectedAgent.secrets.filter((s) => s.id && !baseIds.has(s.id))
    return [...base, ...agentOnly]
  }, [availableSecrets, selectedAgent])

  // Initialize agent editor state when a different agent is selected
  useEffect(() => {
    if (!selectedAgent) {
      if (loadedAgentIdRef.current !== null) {
        loadedAgentIdRef.current = null
        setAgentName('')
        setAgentDescription('')
        setAgentActive(true)
        setAgentStreaming(true)
        setAgentMaxTokens(100000)
        setAgentTemperature(0.7)
        setAgentSystemPrompt('')
        setAgentProviderIds([])
        setAgentProviderModels({})
        setAgentSelectedTools([])
        setAgentSelectedSecrets([])
        setAgentSelectedFunctionIds([])
        setAgentEnvVars([])
        setAgentWebProviderType('')
        setAgentWebProviderSecretId('')
      }
      return
    }

    if (loadedAgentIdRef.current === selectedAgent.id) return

    loadedAgentIdRef.current = selectedAgent.id
    setAgentName(selectedAgent.name || '')
    setAgentDescription(selectedAgent.description || '')
    setAgentActive(selectedAgent.active ?? true)
    setAgentSelectedTools(selectedAgent.tools || [])
    setAgentProviderIds(selectedAgent.providers?.map((p) => p.id) || [])

    // Build providerModels from agent.agentProviders junction data
    const models: Record<string, string> = {}
    if (selectedAgent.agentProviders?.length) {
      for (const ap of selectedAgent.agentProviders) {
        if (ap.model) models[ap.provider.id] = ap.model
      }
    }
    // Backward compat: if no per-provider models but agent.model exists, assign to primary
    if (
      !Object.keys(models).length &&
      selectedAgent.model &&
      selectedAgent.providers?.[0]
    ) {
      models[selectedAgent.providers[0].id] = selectedAgent.model
    }
    setAgentProviderModels(models)

    // Seed aiProviders from agent data to avoid empty tag flash before async fetch
    if (selectedAgent.providers?.length) {
      setAiProviders((prev) =>
        prev?.length
          ? prev
          : selectedAgent
              .providers!.filter((p: any) => p.type === 'ai')
              .map((p: any) => ({
                id: p.id,
                name: p.name || p.id,
                brand: p.brand || '',
              }))
      )
    }

    setAgentMaxTokens(selectedAgent.maxTokens || 100000)
    setAgentSystemPrompt(selectedAgent.systemPrompt || '')
    setAgentStreaming(selectedAgent.environment?.streaming ?? true)
    setAgentTemperature(selectedAgent.environment?.temperature ?? 0.7)

    // Convert envVars object to key-value pairs
    const envVarsPairs = Object.entries(selectedAgent.envVars || {}).map(
      ([key, value], idx) => ({
        id: `env-${idx}`,
        key,
        value,
      })
    )
    setAgentEnvVars(envVarsPairs)

    // Set selected secrets
    setAgentSelectedSecrets(
      (selectedAgent.secrets || []).filter((s) => s.id).map((s) => s.id)
    )

    // Set web provider config
    setAgentWebProviderType(selectedAgent.environment?.webProvider?.type || '')
    setAgentWebProviderSecretId(selectedAgent.environment?.webProvider?.secretId || '')

    // Set function IDs from project config
    const projectConfig = selectedAgent.getProjectConfig?.(projectId!)
    setAgentSelectedFunctionIds(projectConfig?.functionIds || [])
  }, [selectedAgent, projectId])

  const onConfigChange = useCallback((config: TAgentEndpointConfig | null) => {
    configRef.current = config
    if (configInitializedRef.current) {
      setIsDirty(true)
    } else {
      configInitializedRef.current = true
    }
  }, [])

  const onValidate = useCallback((err: string | null) => {
    validationErrorRef.current = err
  }, [])

  const onSave = useCallback(async () => {
    if (!endpoint?.id || !orgId || !projectId) {
      setError(`Unable to save: missing context. Please reload the page.`)
      return
    }

    if (validationErrorRef.current) {
      setError(validationErrorRef.current)
      return
    }

    if (!configRef.current) {
      setError(`Agent endpoint configuration is missing`)
      return
    }

    setError(null)
    setLoading(true)

    // Build endpoint update promise
    const endpointPromise = updateEndpoint({
      orgId,
      projectId,
      id: endpoint.id,
      data: { options: configRef.current },
    })

    // Build agent update promise (only if an agent is selected)
    let agentPromise: ReturnType<typeof updateAgent> | Promise<null> =
      Promise.resolve(null)
    if (selectedAgentId && selectedAgent) {
      const envVarsObj = agentEnvVars.reduce(
        (acc, pair) => {
          if (pair.key) acc[pair.key] = pair.value
          return acc
        },
        {} as Record<string, string>
      )

      const providers = agentProviderIds.map((id, i) => ({
        id,
        priority: i,
        model: agentProviderModels[id] || null,
      }))

      const buildEnvironment = () => ({
        streaming: agentStreaming,
        temperature: agentTemperature,
        ...(agentWebProviderType
          ? {
              webProvider: {
                type: agentWebProviderType,
                ...(agentWebProviderSecretId
                  ? { secretId: agentWebProviderSecretId }
                  : {}),
              },
            }
          : {}),
      })

      agentPromise = updateAgent({
        orgId,
        projectId,
        id: selectedAgentId,
        data: {
          providers,
          name: agentName,
          active: agentActive,
          envVars: envVarsObj,
          maxTokens: agentMaxTokens,
          tools: agentSelectedTools,
          description: agentDescription,
          systemPrompt: agentSystemPrompt,
          environment: buildEnvironment(),
          secretIds: agentSelectedSecrets,
          functionIds: agentSelectedFunctionIds,
          model: agentProviderModels[agentProviderIds[0]] || '',
        },
      })
    }

    const [endpointResult, agentResult] = await Promise.all([
      endpointPromise,
      agentPromise,
    ])

    setLoading(false)

    const endpointFailed = !!endpointResult?.error
    const agentFailed = !!agentResult?.error

    if (endpointFailed || agentFailed) {
      const endpointMsg = endpointFailed
        ? endpointResult.error?.message || `Failed to update endpoint configuration`
        : null
      const agentMsg = agentFailed
        ? agentResult!.error?.message || `Failed to update agent`
        : null

      if (endpointFailed && !agentFailed) {
        setError(
          `Agent saved, but endpoint update failed: ${endpointMsg}. Retry to save endpoint changes.`
        )
      } else if (!endpointFailed && agentFailed) {
        setError(
          `Endpoint saved, but agent update failed: ${agentMsg}. Retry to save agent changes.`
        )
      } else {
        setError(`${endpointMsg}. ${agentMsg}`)
      }
      return
    }

    setIsDirty(false)
    toast.success(
      selectedAgentId
        ? `Endpoint and agent configuration saved`
        : `Endpoint configuration saved`
    )
  }, [
    orgId,
    projectId,
    agentName,
    agentActive,
    agentEnvVars,
    endpoint?.id,
    selectedAgent,
    agentStreaming,
    agentMaxTokens,
    selectedAgentId,
    agentTemperature,
    agentDescription,
    agentSystemPrompt,
    agentProviderIds,
    agentSelectedTools,
    agentProviderModels,
    agentSelectedSecrets,
    agentWebProviderType,
    agentSelectedFunctionIds,
    agentWebProviderSecretId,
  ])

  if (!endpoint) return null

  return (
    <Box>
      <AgentSection title='Endpoint Configuration'>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && (
            <ErrorAlert
              message={error}
              onClose={() => setError(null)}
            />
          )}

          <EndpointAgent
            loading={loading}
            endpoint={endpoint}
            onValidate={onValidate}
            onConfigChange={onConfigChange}
            availableAgents={availableAgents}
            availableSecrets={availableSecrets}
            availableProviders={availableProviders}
            availableFunctions={availableFunctions}
          />
        </Box>
      </AgentSection>

      <AgentSection title='Agent Configuration'>
        {selectedAgent ? (
          <Stack spacing={3}>
            <BasicInfoForm
              name={agentName}
              loading={loading}
              aiProviders={aiProviders}
              onNameChange={setAgentName}
              description={agentDescription}
              providerIds={agentProviderIds}
              providerModels={agentProviderModels}
              onProviderChange={setAgentProviderIds}
              onModelChange={setAgentProviderModels}
              onDescriptionChange={setAgentDescription}
            />

            <Divider />

            <ModelConfigForm
              loading={loading}
              maxTokens={agentMaxTokens}
              temperature={agentTemperature}
              onMaxTokensChange={setAgentMaxTokens}
              onTemperatureChange={setAgentTemperature}
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
                id='agent-system-prompt-editor'
                disabled={loading}
                language='markdown'
                options={MonacoOptions}
                defaultValue={agentSystemPrompt}
                label='Define the agent&apos;s behavior and role'
                onChange={(value) => setAgentSystemPrompt(value || '')}
              />
            </Box>

            <Divider />

            <ToolsSelector
              loading={loading}
              onChange={setAgentSelectedTools}
              selectedTools={agentSelectedTools}
            />

            {projectId && (
              <>
                <Divider />

                <FunctionsSelector
                  loading={loading}
                  onChange={setAgentSelectedFunctionIds}
                  availableFunctions={availableFunctions}
                  selectedFunctionIds={agentSelectedFunctionIds}
                />
              </>
            )}

            <Divider />

            <KeyValueEditor
              pairs={agentEnvVars}
              disabled={loading}
              secrets={agentSecretsList}
              onChange={setAgentEnvVars}
              label='Environment Variables'
              enableSecretReferences={true}
              keyPlaceholder='Variable name'
              valuePlaceholder='Value or {{secret-name}}'
            />

            <Divider />

            <WebProviderSettings
              loading={loading}
              secretsList={agentSecretsList}
              webProviderType={agentWebProviderType}
              webProviderSecretId={agentWebProviderSecretId}
              onWebProviderTypeChange={setAgentWebProviderType}
              onWebProviderSecretIdChange={setAgentWebProviderSecretId}
            />

            <Divider />

            <SecretsSelector
              loading={loading}
              secretsList={agentSecretsList}
              onChange={setAgentSelectedSecrets}
              selectedSecrets={agentSelectedSecrets}
            />

            <Divider />

            <AgentSettingsForm
              loading={loading}
              active={agentActive}
              streaming={agentStreaming}
              onActiveChange={setAgentActive}
              onStreamingChange={setAgentStreaming}
            />
          </Stack>
        ) : (
          <Typography
            variant='body2'
            color='text.secondary'
          >
            Select an agent above to edit its configuration.
          </Typography>
        )}
      </AgentSection>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <LoadingButton
          color='primary'
          onClick={onSave}
          loading={loading}
          variant='contained'
          Icon={<SaveIcon />}
          loadingText='Saving...'
        >
          Save
        </LoadingButton>
      </Box>

      <Dialog
        open={showDialog}
        onClose={onCancelLeave}
      >
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <Typography variant='body2'>
            You have unsaved changes. Discard and continue?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancelLeave}>Stay</Button>
          <Button
            color='error'
            variant='contained'
            onClick={onConfirmLeave}
          >
            Discard
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
