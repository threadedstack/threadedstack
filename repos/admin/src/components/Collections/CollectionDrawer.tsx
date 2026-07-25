import type { TCollectionWithCount, TCollectionSchema } from '@tdsk/domain'

import { Box } from '@mui/material'
import { Code } from '@TAF/components/Code/Code'
import { MonacoOptions } from '@TAF/constants/monaco'
import { useState, useEffect, useCallback } from 'react'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { Drawer, TextInput, DrawerActions } from '@tdsk/components'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { createCollection } from '@TAF/actions/collections/api/createCollection'
import { updateCollection } from '@TAF/actions/collections/api/updateCollection'

export type TCollectionDrawer = {
  open: boolean
  orgId?: string
  projectId?: string
  onClose: () => void
  collection?: TCollectionWithCount | null
  onRemove?: (collection: TCollectionWithCount) => void
}

const editorOpts = {
  ...MonacoOptions,
  lineNumbers: `off` as const,
  folding: false,
}

export const CollectionDrawer = ({
  open,
  orgId,
  projectId,
  collection,
  onRemove,
  onClose: onCloseCB,
}: TCollectionDrawer) => {
  const isEditMode = !!collection
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(``)
  const [description, setDescription] = useState(``)
  const [schemaText, setSchemaText] = useState(``)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    if (collection) {
      setName(collection.name)
      setDescription(collection.description || ``)
      setSchemaText(collection.schema ? JSON.stringify(collection.schema, null, 2) : ``)
    } else {
      setName(``)
      setDescription(``)
      setSchemaText(``)
    }
  }, [collection])

  const onClose = () => {
    if (loading) return
    onCloseCB?.()
    setError(null)
    setName(``)
    setDescription(``)
    setSchemaText(``)
  }

  const onSchemaChange = useCallback((val?: string) => {
    setSchemaText(val || ``)
  }, [])

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!name.trim()) return setError(`Collection name is required`)
    if (!orgId || !projectId) return setError(`Organization and project are required`)

    let schema: TCollectionSchema | null = null
    if (schemaText.trim()) {
      try {
        schema = JSON.parse(schemaText)
      } catch {
        return setError(`Schema must be valid JSON`)
      }
    }

    setLoading(true)
    setError(null)

    const data = {
      name: name.trim(),
      description: description.trim() || null,
      schema,
    }

    let result: { data?: any; error?: Error } | undefined

    if (isEditMode && collection) {
      result = await updateCollection(orgId, projectId, collection.name, data)
    } else {
      result = await createCollection(orgId, projectId, data)
    }

    setLoading(false)

    if (result?.error) {
      const action = isEditMode ? `update` : `create`
      const msg = result.error?.message || `Please try again.`
      setError(`Failed to ${action} collection. ${msg}`)
    } else {
      onClose()
    }
  }

  const { actions } = useDrawerActions({
    onSave,
    onClose,
    onRemove: () => onRemove?.(collection),
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEditMode ? `Edit Collection` : `Create New Collection`}
      actions={
        <DrawerActions
          form='collection-form'
          actions={actions}
          loading={loading}
          disabled={loading}
          editing={isEditMode}
        />
      }
    >
      <form id='collection-form'>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && (
            <ErrorAlert
              message={error}
              onClose={() => setError(null)}
            />
          )}

          <TextInput
            required
            fullWidth
            autoFocus
            value={name}
            disabled={loading}
            label='Collection Name'
            id='tdsk-collection-name-input'
            placeholder='Enter collection name'
            onChange={(e) => setName(e.target.value)}
          />

          <TextInput
            fullWidth
            textarea
            minRows={2}
            maxRows={4}
            value={description}
            disabled={loading}
            label='Description'
            id='tdsk-collection-description-input'
            placeholder='Enter collection description'
            onChange={(e) => setDescription(e.target.value)}
          />

          <Code
            height='300px'
            value={schemaText}
            disabled={loading}
            language='json'
            options={editorOpts}
            label='Schema (optional)'
            id='tdsk-collection-schema-editor'
            onChange={onSchemaChange}
            placeholder='Enter a JSON array of field definitions, e.g. [{"name":"status","type":"string"}]'
          />
        </Box>
      </form>
    </Drawer>
  )
}
