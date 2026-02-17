import type { TKeyValuePair } from '@TAF/types'
import type { Function as TDFunction } from '@tdsk/domain'

import { useAtomValue } from 'jotai'
import { EFunLanguage } from '@tdsk/domain'
import { cls } from '@keg-hub/jsutils/cls'
import { Box, Autocomplete } from '@mui/material'
import { Code } from '@TAF/components/Code/Code'
import { LanguageOpts } from '@TAF/constants/values'
import { useState, useEffect, useMemo } from 'react'
import { endpointsState } from '@TAF/state/endpoints'
import { fetchEndpoints } from '@TAF/actions/endpoints'
import { fetchAgents } from '@TAF/actions/agents/api/fetchAgents'
import type { TParamRow } from '@TAF/components/ParamsEditor'
import { ParamsEditor } from '@TAF/components/ParamsEditor'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { createFunction, updateFunction, deleteFunction } from '@TAF/actions/functions'
import {
  ConfirmDelete,
  Drawer,
  DrawerActions,
  TextInput,
  SelectInput,
  AutoInputText,
  InputStateHandler,
} from '@tdsk/components'

export type TFunctionDrawer = {
  open: boolean
  orgId: string
  projectId: string
  onClose: () => void
  onSuccess?: () => void
  func?: TDFunction | null
}

export const FunctionDrawer = ({
  open,
  func,
  orgId,
  projectId,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TFunctionDrawer) => {
  const isEditMode = Boolean(func)
  const endpoints = useAtomValue(endpointsState)

  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(func?.name || ``)
  const [loaded, setLoaded] = useState(Boolean(func?.id))
  const [error, setError] = useState<string | null>(null)
  const [branch, setBranch] = useState(func?.branch || `main`)
  const [inputSchema, setInputSchema] = useState<TParamRow[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [agentIds, setAgentIds] = useState<string[]>(func?.agentIds || [])
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([])
  const [endpointId, setEndpointId] = useState(func?.endpointId || ``)
  const [description, setDescription] = useState(func?.description || ``)
  const [content, setContent] = useState(func?.content || `\n\n\n\n\n\n`)
  const [dependencyPairs, setDependencyPairs] = useState<TKeyValuePair[]>([])
  const [language, setLanguage] = useState(func?.language || EFunLanguage.typescript)

  // Fetch endpoints and agents when the drawer opens
  useEffect(() => {
    if (open && orgId && projectId) {
      fetchEndpoints({ orgId, projectId })
      fetchAgents({ orgId, projectId }).then((result) => {
        if (result?.data) {
          const agentList = (
            Array.isArray(result.data) ? result.data : Object.values(result.data)
          ).map((a: any) => ({ id: a.id, name: a.name || a.id }))
          setAgents(agentList)
        }
      })
    }
  }, [open, orgId, projectId])

  // Create endpoint options for the select dropdown
  const endpointOptions = useMemo(() => {
    if (!endpoints) return []

    return Object.values(endpoints)
      .filter((endpoint) => endpoint.projectId === projectId)
      .map((endpoint) => ({
        label: `${endpoint.method} ${endpoint.path}`,
        value: endpoint.id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [endpoints, projectId])

  const agentOptions = useMemo(() => {
    return agents.map((a) => ({ label: a.name, value: a.id }))
  }, [agents])

  useEffect(() => {
    if (!func || loaded) return

    setLoaded(true)
    setName(func.name || ``)
    setBranch(func.branch || `main`)
    setAgentIds(func.agentIds || [])
    setEndpointId(func.endpointId || ``)
    setDescription(func.description || ``)
    setContent(func?.content || `\n\n\n\n\n\n`)
    setLanguage(func.language || EFunLanguage.typescript)

    // Load inputSchema, falling back to legacy defaultArgs conversion
    if (func?.inputSchema && Array.isArray(func.inputSchema)) {
      setInputSchema(
        func.inputSchema.map((p: any, index: number) => ({
          ...p,
          id: `param-${index}-${Date.now()}`,
        }))
      )
    } else if (func?.defaultArgs && typeof func.defaultArgs === 'object') {
      setInputSchema(
        Object.entries(func.defaultArgs).map(([key, value], index) => ({
          id: `param-${index}-${Date.now()}`,
          name: key,
          type: `string` as const,
          description: ``,
          required: false,
          default: value,
        }))
      )
    } else {
      setInputSchema([])
    }

    // Convert dependencies object to key-value pairs
    if (func?.dependencies && typeof func.dependencies === 'object') {
      const pairs: TKeyValuePair[] = Object.entries(func.dependencies).map(
        ([key, value], index) => ({
          id: `dep-${index}-${Date.now()}`,
          key,
          value: String(value),
        })
      )
      setDependencyPairs(pairs)
    } else {
      setDependencyPairs([])
    }

    setError(null)
    setShowDeleteConfirm(false)
  }, [func, loaded])

  const onClose = () => {
    if (loading) return

    setName(``)
    setError(null)
    setContent(``)
    setLoaded(false)
    setAgentIds([])
    setEndpointId(``)
    setBranch(`main`)
    setDescription(``)
    setInputSchema([])
    setDependencyPairs([])
    setLanguage(`typescript`)
    setShowDeleteConfirm(false)
    onCloseCB?.()
  }

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!name.trim()) return setError(`Function name is required`)
    if (!language) return setError(`Language is required`)

    setError(null)
    setLoading(true)

    // Convert ParamRow[] to clean TFunctionParam[] (strip client IDs)
    const parsedInputSchema =
      inputSchema.length > 0
        ? inputSchema
            .filter((p) => p.name.trim())
            .map(({ id, ...param }) => ({
              ...param,
              name: param.name.trim(),
              description: param.description?.trim() || undefined,
              default:
                param.default != null && param.default !== `` ? param.default : undefined,
            }))
        : undefined

    // Build defaultArgs from inputSchema defaults for backward compatibility
    const parsedDefaultArgs: Record<string, any> | undefined = parsedInputSchema?.length
      ? parsedInputSchema.reduce(
          (acc, p) => {
            if (p.default !== undefined) acc[p.name] = p.default
            return acc
          },
          {} as Record<string, any>
        )
      : undefined

    // Convert dependency pairs to object
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

    const functionData = {
      content,
      language,
      name: name.trim(),
      defaultArgs: parsedDefaultArgs,
      inputSchema: parsedInputSchema,
      branch: branch.trim() || 'main',
      dependencies: parsedDependencies,
      agentIds: agentIds.length > 0 ? agentIds : undefined,
      endpointId: endpointId || undefined,
      description: description.trim() || undefined,
    }

    const result = isEditMode
      ? await updateFunction({ orgId, projectId, id: func?.id, data: functionData })
      : await createFunction({ orgId, projectId, data: functionData })

    setLoading(false)

    if (result.error) {
      setError(
        `Failed to ${isEditMode ? `update` : `create`} function. Please try again.`
      )
    } else {
      onClose()
      onSuccessCB?.()
    }
  }

  const onRemove = async () => {
    if (!func) return

    setLoading(true)
    setError(null)

    const result = await deleteFunction({ orgId, projectId, id: func.id })

    setLoading(false)

    if (result.error) {
      setError(`Failed to delete function. Please try again.`)
      setShowDeleteConfirm(false)
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
      title={isEditMode ? `Edit Function` : `Create New Function`}
      actions={
        <DrawerActions
          form='function-form'
          editing={isEditMode}
          actions={actions}
          loading={loading}
          disabled={loading || showDeleteConfirm}
        />
      }
    >
      <form id='function-form'>
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
          {error && (
            <ErrorAlert
              message={error}
              onClose={() => setError(null)}
            />
          )}

          {isEditMode && showDeleteConfirm && (
            <ConfirmDelete
              deleting={loading}
              onConfirm={onRemove}
              onCancel={() => setShowDeleteConfirm(false)}
              itemName={func?.name || `this function`}
            />
          )}

          <TextInput
            required
            fullWidth
            value={name}
            disabled={loading}
            id='function-name'
            label='Function Name'
            placeholder='Enter function name'
            onChange={(e) => setName(e.target.value)}
          />

          <SelectInput
            required
            label='Language'
            value={language}
            disabled={loading}
            items={LanguageOpts}
            id='function-language'
            onChange={(e) => setLanguage(e.target.value)}
          />

          <TextInput
            textarea
            fullWidth
            minRows={3}
            disabled={loading}
            label='Description'
            value={description}
            id='function-description'
            placeholder='Enter function description (optional)'
            onChange={(e) => setDescription(e.target.value)}
          />

          <SelectInput
            id='function-endpoint'
            label='Endpoint'
            value={endpointId}
            onChange={(e) => setEndpointId(e.target.value)}
            items={[{ label: `No endpoint`, value: `` }, ...endpointOptions]}
            disabled={loading || endpointOptions.length === 0}
            description={
              endpointOptions.length === 0
                ? `No endpoints available. Create an endpoint first.`
                : `Select an endpoint to associate with this function`
            }
          />

          <InputStateHandler
            id='function-agents'
            disabled={loading || agents.length === 0}
            label='Agents'
            description={
              agents.length === 0
                ? `No agents available. Create an agent first.`
                : `Select agents to attach this function as a tool`
            }
          >
            <Autocomplete
              multiple
              id='function-agents'
              className={cls(`tdsk-auto-input`, loading && `disabled`)}
              value={agentIds}
              options={agents.map((a) => a.id)}
              getOptionLabel={(id) => agents.find((a) => a.id === id)?.name || id}
              onChange={(_, updates) => setAgentIds(updates)}
              disabled={loading || agents.length === 0}
              renderInput={(params) => (
                <AutoInputText
                  {...params}
                  sx={{ padding: `0px` }}
                  placeholder='Select agents...'
                />
              )}
            />
          </InputStateHandler>

          <TextInput
            fullWidth
            label='Branch'
            value={branch}
            disabled={loading}
            placeholder='main'
            id='function-branch'
            onChange={(e) => setBranch(e.target.value)}
            description='Branch to use (default: main)'
          />

          <ParamsEditor
            disabled={loading}
            params={inputSchema}
            label='Input Parameters'
            onChange={setInputSchema}
          />

          <KeyValueEditor
            disabled={loading}
            label='Dependencies'
            pairs={dependencyPairs}
            keyPlaceholder='Package name'
            onChange={setDependencyPairs}
            enableSecretReferences={false}
            valuePlaceholder='Version (e.g., ^1.0.0)'
          />

          <Code
            required
            label='Content'
            disabled={loading}
            language={language}
            id='function-content'
            defaultValue={content || `\n\n\n\n\n\n`}
            placeholder={`The ${language} code....`}
            onChange={(data: string) => setContent(data)}
          />
        </Box>
      </form>
    </Drawer>
  )
}
