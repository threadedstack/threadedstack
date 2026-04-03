import type { TKeyValuePair } from '@TAF/types'
import type { TFaaSEndpointConfig } from '@tdsk/domain'
import type { TParamRow } from '@TAF/components/ParamsEditor'
import type { Function as FunctionModel } from '@tdsk/domain'

import { toast } from 'sonner'
import { EFunLanguage } from '@tdsk/domain'
import SaveIcon from '@mui/icons-material/Save'
import { Code } from '@TAF/components/Code/Code'
import { LanguageOpts } from '@TAF/constants/values'
import { TextInput, SelectInput } from '@tdsk/components'
import { ParamsEditor } from '@TAF/components/ParamsEditor'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
import { AgentSection } from '@TAF/components/Agents/AgentSection'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { fetchSecrets } from '@TAF/actions/secrets/api/fetchSecrets'
import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { FaasEndpoint } from '@TAF/components/Endpoints/Faas/EndpointFass'
import { updateEndpoint } from '@TAF/actions/endpoints/api/updateEndpoint'
import { updateFunction } from '@TAF/actions/functions/api/updateFunction'
import { fetchFunctions } from '@TAF/actions/functions/api/fetchFunctions'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'
import { useUnsavedChangesGuard } from '@TAF/hooks/endpoints/useUnsavedChangesGuard'
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
} from '@mui/material'
import {
  useActiveEndpoint,
  useActiveOrgId,
  useActiveProjectId,
  useProjectSecrets,
  useProjectFunctions,
  useFaasFormState as useFaasFormStateSelector,
} from '@TAF/state/selectors'

const initInputSchema = (func: FunctionModel): TParamRow[] => {
  if (func.inputSchema && Array.isArray(func.inputSchema)) {
    return func.inputSchema.map((p: any, index: number) => ({
      ...p,
      id: `param-${index}-${Date.now()}`,
    }))
  }

  if (func.defaultArgs && typeof func.defaultArgs === 'object') {
    return Object.entries(func.defaultArgs).map(([key, value], index) => ({
      id: `param-${index}-${Date.now()}`,
      name: key,
      type: 'string' as const,
      description: '',
      required: false,
      default: value,
    }))
  }

  return []
}

const initDependencyPairs = (func: FunctionModel): TKeyValuePair[] => {
  if (func.dependencies && typeof func.dependencies === 'object') {
    return Object.entries(func.dependencies).map(([key, value], index) => ({
      id: `dep-${index}-${Date.now()}`,
      key,
      value: String(value),
    }))
  }

  return []
}

const buildFunctionPayload = (
  name: string,
  language: string,
  description: string,
  content: string,
  inputSchema: TParamRow[],
  dependencyPairs: TKeyValuePair[]
) => {
  const parsedInputSchema =
    inputSchema.length > 0
      ? inputSchema
          .filter((p) => p.name.trim())
          .map(({ id, ...param }) => ({
            ...param,
            name: param.name.trim(),
            description: param.description?.trim() || undefined,
            default:
              param.default != null && param.default !== '' ? param.default : undefined,
          }))
      : undefined

  const parsedDefaultArgs: Record<string, any> | undefined = parsedInputSchema?.length
    ? parsedInputSchema.reduce(
        (acc, p) => {
          if (p.default !== undefined) acc[p.name] = p.default
          return acc
        },
        {} as Record<string, any>
      )
    : undefined

  const parsedDependencies: Record<string, any> | undefined =
    dependencyPairs.length > 0
      ? dependencyPairs.reduce(
          (acc, pair) => {
            if (pair.key.trim() && pair.value.trim())
              acc[pair.key.trim()] = pair.value.trim()
            return acc
          },
          {} as Record<string, any>
        )
      : undefined

  return {
    content,
    language,
    name: name.trim(),
    defaultArgs: parsedDefaultArgs,
    inputSchema: parsedInputSchema,
    dependencies: parsedDependencies,
    description: description.trim() || undefined,
  }
}

export const FaasConfigTab = () => {
  const [orgId] = useActiveOrgId()
  const [endpoint] = useActiveEndpoint()
  const [projectId] = useActiveProjectId()
  const [secretsMap] = useProjectSecrets()
  const [functionsMap] = useProjectFunctions()
  const [faasFormState] = useFaasFormStateSelector()

  const validationErrorRef = useRef<string | null>(null)
  const configRef = useRef<TFaaSEndpointConfig | null>(null)

  const configInitializedRef = useRef(false)
  const [isDirty, setIsDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Function editor state
  const [funcName, setFuncName] = useState('')
  const [funcDescription, setFuncDescription] = useState('')
  const [funcContent, setFuncContent] = useState('\n\n\n\n\n\n')
  const [funcInputSchema, setFuncInputSchema] = useState<TParamRow[]>([])
  const [funcLanguage, setFuncLanguage] = useState(EFunLanguage.typescript as string)
  const [funcDependencyPairs, setFuncDependencyPairs] = useState<TKeyValuePair[]>([])

  // Track which function is loaded in the editor to avoid re-initializing on every render
  const loadedFuncIdRef = useRef<string | null>(null)

  // Reset dirty state when endpoint changes
  useEffect(() => {
    setIsDirty(false)
    configInitializedRef.current = false
  }, [endpoint?.id])

  const availableSecrets = useMemo(
    () => (secretsMap ? Object.values(secretsMap) : []),
    [secretsMap]
  )

  const availableFunctions = useMemo(
    () => (functionsMap ? Object.values(functionsMap) : []),
    [functionsMap]
  )

  const selectedFunctionId = faasFormState?.functionId || ''

  const selectedFunction = useMemo(() => {
    if (!selectedFunctionId || !functionsMap) return null
    return functionsMap[selectedFunctionId] || null
  }, [selectedFunctionId, functionsMap])

  const hasChanges = useMemo(() => {
    if (isDirty) return true
    if (!selectedFunction) return false

    return (
      funcName !== (selectedFunction.name || '') ||
      funcLanguage !== (selectedFunction.language || EFunLanguage.typescript) ||
      funcDescription !== (selectedFunction.description || '') ||
      funcContent !== (selectedFunction.content || '\n\n\n\n\n\n')
    )
  }, [isDirty, selectedFunction, funcName, funcLanguage, funcDescription, funcContent])

  const { showDialog, onConfirmLeave, onCancelLeave } = useUnsavedChangesGuard(hasChanges)

  // Fetch secrets and functions on mount
  useEffect(() => {
    if (orgId && projectId) {
      fetchSecrets({ orgId, projectId })
      fetchFunctions({ orgId, projectId })
    }
  }, [orgId, projectId])

  // Initialize function editor state when a function is selected
  useEffect(() => {
    if (!selectedFunction) {
      if (loadedFuncIdRef.current !== null) {
        loadedFuncIdRef.current = null
        setFuncName('')
        setFuncLanguage(EFunLanguage.typescript)
        setFuncDescription('')
        setFuncContent('\n\n\n\n\n\n')
        setFuncInputSchema([])
        setFuncDependencyPairs([])
      }
      return
    }

    if (loadedFuncIdRef.current === selectedFunction.id) return

    loadedFuncIdRef.current = selectedFunction.id
    setFuncName(selectedFunction.name || '')
    setFuncLanguage(selectedFunction.language || EFunLanguage.typescript)
    setFuncDescription(selectedFunction.description || '')
    setFuncContent(selectedFunction.content || '\n\n\n\n\n\n')
    setFuncInputSchema(initInputSchema(selectedFunction))
    setFuncDependencyPairs(initDependencyPairs(selectedFunction))
  }, [selectedFunction])

  const onConfigChange = useCallback((config: TFaaSEndpointConfig | null) => {
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
      setError(`FaaS configuration is missing`)
      return
    }

    setError(null)
    setLoading(true)

    const endpointPromise = updateEndpoint({
      orgId,
      projectId,
      id: endpoint.id,
      data: { options: configRef.current },
    })

    const functionPromise =
      selectedFunctionId && selectedFunction
        ? updateFunction({
            orgId,
            projectId,
            id: selectedFunctionId,
            data: buildFunctionPayload(
              funcName,
              funcLanguage,
              funcDescription,
              funcContent,
              funcInputSchema,
              funcDependencyPairs
            ),
          })
        : Promise.resolve(null)

    const [endpointResult, functionResult] = await Promise.all([
      endpointPromise,
      functionPromise,
    ])

    setLoading(false)

    const endpointFailed = !!endpointResult?.error
    const functionFailed = !!functionResult?.error

    if (endpointFailed || functionFailed) {
      const endpointMsg = endpointFailed
        ? endpointResult.error?.message || 'Failed to update endpoint configuration'
        : null
      const functionMsg = functionFailed
        ? functionResult!.error?.message || 'Failed to update function'
        : null

      if (endpointFailed && !functionFailed) {
        setError(
          `Function saved, but endpoint update failed: ${endpointMsg}. Retry to save endpoint changes.`
        )
      } else if (!endpointFailed && functionFailed) {
        setError(
          `Endpoint saved, but function update failed: ${functionMsg}. Retry to save function changes.`
        )
      } else {
        setError(`${endpointMsg}. ${functionMsg}`)
      }
      return
    }

    setIsDirty(false)
    toast.success(
      selectedFunctionId ? 'Endpoint and function saved' : 'Endpoint configuration saved'
    )
  }, [
    endpoint?.id,
    orgId,
    projectId,
    selectedFunctionId,
    selectedFunction,
    funcName,
    funcLanguage,
    funcDescription,
    funcContent,
    funcInputSchema,
    funcDependencyPairs,
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

          <FaasEndpoint
            endpoint={endpoint}
            loading={loading}
            onValidate={onValidate}
            onConfigChange={onConfigChange}
            availableSecrets={availableSecrets}
            availableFunctions={availableFunctions}
          />
        </Box>
      </AgentSection>

      <AgentSection title='Function Editor'>
        {selectedFunction ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextInput
              required
              fullWidth
              value={funcName}
              disabled={loading}
              id='faas-function-name'
              label='Function Name'
              placeholder='Enter function name'
              onChange={(e) => setFuncName(e.target.value)}
            />

            <SelectInput
              required
              label='Language'
              value={funcLanguage}
              disabled={loading}
              items={LanguageOpts}
              id='faas-function-language'
              onChange={(e) => setFuncLanguage(e.target.value)}
            />

            <TextInput
              textarea
              fullWidth
              minRows={3}
              disabled={loading}
              label='Description'
              value={funcDescription}
              id='faas-function-description'
              placeholder='Enter function description (optional)'
              onChange={(e) => setFuncDescription(e.target.value)}
            />

            <ParamsEditor
              disabled={loading}
              params={funcInputSchema}
              label='Input Parameters'
              onChange={setFuncInputSchema}
            />

            <KeyValueEditor
              disabled={loading}
              label='Dependencies'
              pairs={funcDependencyPairs}
              keyPlaceholder='Package name'
              enableSecretReferences={false}
              onChange={setFuncDependencyPairs}
              valuePlaceholder='Version (e.g., ^1.0.0)'
            />

            <Code
              required
              label='Content'
              disabled={loading}
              language={funcLanguage}
              id='faas-function-content'
              defaultValue={funcContent || '\n\n\n\n\n\n'}
              placeholder={`The ${funcLanguage} code....`}
              onChange={(data: string) => setFuncContent(data)}
            />
          </Box>
        ) : (
          <Typography
            variant='body2'
            color='text.secondary'
          >
            Select a function above to edit its configuration.
          </Typography>
        )}
      </AgentSection>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <LoadingButton
          color='primary'
          onClick={onSave}
          loading={loading}
          Icon={<SaveIcon />}
          variant='contained'
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
