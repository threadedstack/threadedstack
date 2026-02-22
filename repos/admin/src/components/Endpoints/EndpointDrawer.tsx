import type {
  Endpoint,
  TEndpointOpts,
  TEndpointType,
  TProxyEndpointConfig,
  TFaaSEndpointConfig,
  TAgentEndpointConfig,
} from '@tdsk/domain'

import { Box } from '@mui/material'
import { vep } from '@TAF/utils/endpoints'
import { EEndpointType } from '@tdsk/domain'
import { useState, useEffect, useRef } from 'react'
import { useProjectSecrets, useProjectFunctions } from '@TAF/state/selectors'
import { fetchFunctions } from '@TAF/actions/functions/fetchFunctions'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { Drawer, DrawerActions, ConfirmDelete } from '@tdsk/components'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { createEndpoint } from '@TAF/actions/endpoints/api/createEndpoint'
import { updateEndpoint } from '@TAF/actions/endpoints/api/updateEndpoint'
import { deleteEndpoint } from '@TAF/actions/endpoints/api/deleteEndpoint'
import { FaasEndpoint } from '@TAF/components/Endpoints/Faas/EndpointFass'
import { EndpointFormBase } from '@TAF/components/Endpoints/EndpointFormBase'
import { EndpointProxy } from '@TAF/components/Endpoints/Proxy/EndpointProxy'
import { EndpointAgent } from '@TAF/components/Endpoints/Agent/EndpointAgent'

export type TEndpointDrawer = {
  open: boolean
  orgId: string
  projectId: string
  onClose: () => void
  onSuccess?: () => void
  endpoint?: Endpoint | null
}

export const EndpointDrawer = (props: TEndpointDrawer) => {
  const {
    open,
    orgId,
    endpoint,
    projectId,
    onClose: onCloseCB,
    onSuccess: onSuccessCB,
  } = props

  const isEditMode = Boolean(endpoint)

  // Shared state (basic fields)
  const [sharedState, setSharedState] = useState({
    name: '',
    path: '',
    method: 'get',
    public: false,
    endpointType: EEndpointType.proxy as TEndpointType,
  })

  // UI state
  const [uiState, setUiState] = useState({
    loading: false,
    error: null as string | null,
    showDeleteConfirm: false,
  })

  // Type-specific config refs (child forms update these)
  const faasConfigRef = useRef<TFaaSEndpointConfig | null>(null)
  const proxyConfigRef = useRef<TProxyEndpointConfig | null>(null)
  const agentConfigRef = useRef<TAgentEndpointConfig | null>(null)

  const validateTriggerRef = useRef(0)
  const validationErrorRef = useRef<string | null>(null)

  const [secretsMap] = useProjectSecrets()
  const availableSecrets = secretsMap ? Object.values(secretsMap) : []

  const [functionsMap] = useProjectFunctions()
  const availableFunctions = functionsMap ? Object.values(functionsMap) : []

  useEffect(() => {
    if (endpoint) {
      setSharedState({
        name: endpoint.name || '',
        path: endpoint.path || '',
        method: endpoint.method || 'get',
        public: endpoint.public || false,
        endpointType: endpoint.type || EEndpointType.proxy,
      })
      setUiState({ loading: false, error: null, showDeleteConfirm: false })
    } else {
      setSharedState({
        name: '',
        path: '',
        method: 'get',
        public: false,
        endpointType: EEndpointType.proxy,
      })
      setUiState({ loading: false, error: null, showDeleteConfirm: false })
    }
  }, [endpoint])

  useEffect(() => {
    if (open && orgId && projectId) {
      fetchFunctions({ orgId, projectId })
    }
  }, [open, orgId, projectId])

  const onSharedStateChange = (updates: Partial<typeof sharedState>) => {
    setSharedState((prev) => ({ ...prev, ...updates }))
  }

  const onProxyConfigChange = (config: TProxyEndpointConfig | null) => {
    proxyConfigRef.current = config
  }

  const onFaasConfigChange = (config: TFaaSEndpointConfig | null) => {
    faasConfigRef.current = config
  }

  const onAgentConfigChange = (config: TAgentEndpointConfig | null) => {
    agentConfigRef.current = config
  }

  const onValidate = (error: string | null) => {
    validationErrorRef.current = error
  }

  const onClose = () => {
    if (!uiState.loading) {
      setSharedState({
        name: '',
        path: '',
        method: 'get',
        public: false,
        endpointType: EEndpointType.proxy,
      })
      setUiState({ loading: false, error: null, showDeleteConfirm: false })
      proxyConfigRef.current = null
      faasConfigRef.current = null
      agentConfigRef.current = null
      validationErrorRef.current = null
      onCloseCB?.()
    }
  }

  const onSave = async (evt: any) => {
    evt.preventDefault()

    // 1. Validate shared fields
    const sharedError = vep.shared(sharedState.name, sharedState.path)

    if (sharedError) return setUiState({ ...uiState, error: sharedError })

    // 2. Trigger type-specific validation
    validateTriggerRef.current++
    await new Promise((resolve) => setTimeout(resolve, 0))

    if (validationErrorRef.current)
      return setUiState({ ...uiState, error: validationErrorRef.current })

    // 3. Build options object based on type
    let options: TEndpointOpts<TEndpointType>
    let headers: Record<string, string> = {}

    if (sharedState.endpointType === EEndpointType.proxy) {
      if (!proxyConfigRef.current)
        return setUiState({ ...uiState, error: `Proxy configuration is missing` })

      options = proxyConfigRef.current
    } else if (sharedState.endpointType === EEndpointType.faas) {
      if (!faasConfigRef.current)
        return setUiState({ ...uiState, error: `FaaS configuration is missing` })

      options = faasConfigRef.current
    } else if (sharedState.endpointType === EEndpointType.agent) {
      if (!agentConfigRef.current)
        return setUiState({ ...uiState, error: `Agent configuration is missing` })

      options = agentConfigRef.current
    } else {
      options = {} as any
    }

    // 4. Submit
    setUiState({ ...uiState, loading: true, error: null })

    const result =
      isEditMode && endpoint
        ? await updateEndpoint({
            orgId,
            projectId,
            id: endpoint.id,
            data: {
              headers,
              options,
              method: sharedState.method,
              public: sharedState.public,
              name: sharedState.name.trim(),
              path: sharedState.path.trim(),
              type: sharedState.endpointType,
            },
          })
        : await createEndpoint({
            orgId,
            projectId,
            data: {
              headers,
              options,
              public: sharedState.public,
              method: sharedState.method,
              name: sharedState.name.trim(),
              path: sharedState.path.trim(),
              type: sharedState.endpointType,
            },
          })

    setUiState({ loading: false, error: null, showDeleteConfirm: false })

    if (result.error) {
      const errorMessage = isEditMode
        ? `Failed to update endpoint. Please try again.`
        : `Failed to create endpoint. Please try again.`
      setUiState({ ...uiState, error: result.error.message || errorMessage })
    } else {
      onClose()
      onSuccessCB?.()
    }
  }

  const onRemove = async () => {
    if (!endpoint) return

    setUiState({ ...uiState, loading: true, error: null })

    const result = await deleteEndpoint({ orgId, projectId, id: endpoint.id })

    setUiState({ loading: false, error: null, showDeleteConfirm: false })

    if (result.error) {
      setUiState({
        ...uiState,
        error: result.error.message || `Failed to delete endpoint. Please try again.`,
        showDeleteConfirm: false,
      })
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

  const { actions } = useDrawerActions({
    onSave,
    onClose,
    onRemove,
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEditMode ? 'Edit Endpoint' : 'Create New Endpoint'}
      actions={
        <DrawerActions
          actions={actions}
          form='endpoint-form'
          editing={isEditMode}
          loading={uiState.loading}
          disabled={uiState.loading || uiState.showDeleteConfirm}
        />
      }
    >
      <form id='endpoint-form'>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {uiState.error && (
            <ErrorAlert
              message={uiState.error}
              onClose={() => setUiState({ ...uiState, error: null })}
            />
          )}

          {uiState.showDeleteConfirm && (
            <ConfirmDelete
              onConfirm={onRemove}
              deleting={uiState.loading}
              itemName={sharedState.name}
              warnText='This action can not be undone!'
              onCancel={() => setUiState({ ...uiState, showDeleteConfirm: false })}
            />
          )}

          <EndpointFormBase
            sharedState={sharedState}
            disabled={uiState.loading}
            onChange={onSharedStateChange}
          />

          {sharedState.endpointType === EEndpointType.proxy && (
            <EndpointProxy
              endpoint={endpoint}
              onValidate={onValidate}
              loading={uiState.loading}
              availableSecrets={availableSecrets}
              onConfigChange={onProxyConfigChange}
            />
          )}

          {sharedState.endpointType === EEndpointType.faas && (
            <FaasEndpoint
              endpoint={endpoint}
              onValidate={onValidate}
              loading={uiState.loading}
              availableSecrets={availableSecrets}
              availableFunctions={availableFunctions}
              onConfigChange={onFaasConfigChange}
            />
          )}

          {sharedState.endpointType === EEndpointType.agent && (
            <EndpointAgent
              endpoint={endpoint}
              onValidate={onValidate}
              loading={uiState.loading}
              availableSecrets={availableSecrets}
              onConfigChange={onAgentConfigChange}
            />
          )}
        </Box>
      </form>
    </Drawer>
  )
}
