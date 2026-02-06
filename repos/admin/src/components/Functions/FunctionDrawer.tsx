import type { TKeyValuePair } from '@TAF/types'
import type { Function as TDFunction } from '@tdsk/domain'

import { useAtomValue } from 'jotai'
import { EFunLanguage } from '@tdsk/domain'
import { Box } from '@mui/material'
import { Code } from '@TAF/components/Code/Code'
import { LanguageOpts } from '@TAF/constants/values'
import { useState, useEffect, useMemo } from 'react'
import { endpointsState } from '@TAF/state/endpoints'
import { fetchEndpoints } from '@TAF/actions/endpoints'
import { ArrayEditor } from '@TAF/components/ArrayEditor'
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
} from '@tdsk/components'

export type TFunctionDrawer = {
  open: boolean
  projectId: string
  onClose: () => void
  onSuccess?: () => void
  func?: TDFunction | null
}

export const FunctionDrawer = ({
  open,
  func,
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
  const [defaultArgs, setDefaultArgs] = useState<string[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [endpointId, setEndpointId] = useState(func?.endpointId || ``)
  const [description, setDescription] = useState(func?.description || ``)
  const [content, setContent] = useState(func?.content || `\n\n\n\n\n\n`)
  const [dependencyPairs, setDependencyPairs] = useState<TKeyValuePair[]>([])
  const [language, setLanguage] = useState(func?.language || EFunLanguage.typescript)

  // Fetch endpoints when the drawer opens
  useEffect(() => {
    open && projectId && fetchEndpoints({ projectId })
  }, [open, projectId])

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

  useEffect(() => {
    if (!func || loaded) return

    setLoaded(true)
    setName(func.name || ``)
    setBranch(func.branch || `main`)
    setEndpointId(func.endpointId || ``)
    setDescription(func.description || ``)
    setContent(func?.content || `\n\n\n\n\n\n`)
    setLanguage(func.language || EFunLanguage.typescript)

    // Convert defaultArgs object to array of string values
    if (func?.defaultArgs && typeof func.defaultArgs === 'object') {
      setDefaultArgs(Object.values(func.defaultArgs).map((v) => String(v)))
    } else {
      setDefaultArgs([])
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
    setEndpointId(``)
    setBranch(`main`)
    setDescription(``)
    setDefaultArgs([])
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

    // Convert defaultArgs array to object with indices as keys
    const parsedDefaultArgs: Record<string, any> | undefined =
      defaultArgs.length > 0
        ? defaultArgs.reduce(
            (acc, arg, index) => {
              if (arg.trim()) {
                acc[index.toString()] = arg.trim()
              }
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
      branch: branch.trim() || 'main',
      dependencies: parsedDependencies,
      endpointId: endpointId || undefined,
      description: description.trim() || undefined,
    }

    const result = isEditMode
      ? await updateFunction(func?.id, functionData)
      : await createFunction({ ...functionData, projectId })

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

    const result = await deleteFunction(func.id)

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
      actionsSx={
        isEditMode ? { justifyContent: `space-between`, px: 3, pb: 2 } : undefined
      }
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

          <ArrayEditor
            disabled={loading}
            items={defaultArgs}
            placeholder='Argument'
            label='Default Arguments'
            onChange={setDefaultArgs}
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
