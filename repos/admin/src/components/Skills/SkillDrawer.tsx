import type { Skill } from '@tdsk/domain'

import { Box } from '@mui/material'
import { Code } from '@TAF/components/Code/Code'
import { MonacoOptions } from '@TAF/constants/monaco'
import { useState, useEffect, useCallback } from 'react'
import { createSkill } from '@TAF/actions/skills/api/createSkill'
import { updateSkill } from '@TAF/actions/skills/api/updateSkill'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { Drawer, TextInput, DrawerActions } from '@tdsk/components'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'

export type TSkillDrawer = {
  open: boolean
  orgId?: string
  onClose: () => void
  skill?: Skill | null
  onRemove?: (skill: Skill) => void
  onCreated?: (skillId: string) => void
}

const editorOpts = {
  ...MonacoOptions,
  lineNumbers: `off` as const,
  folding: false,
}

export const SkillDrawer = ({
  open,
  orgId,
  skill,
  onRemove,
  onCreated,
  onClose: onCloseCB,
}: TSkillDrawer) => {
  const isEditMode = !!skill
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(``)
  const [content, setContent] = useState(``)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    if (skill) {
      setName(skill.name)
      setContent(skill.instructions || ``)
    } else {
      setName(``)
      setContent(``)
    }
  }, [skill])

  const onClose = () => {
    if (loading) return
    onCloseCB?.()
    setError(null)
    setName(``)
    setContent(``)
  }

  const onEditorChange = useCallback((val?: string) => {
    setContent(val || ``)
  }, [])

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!name.trim()) return setError(`Skill name is required`)
    if (!orgId) return setError(`Organization is required`)

    setLoading(true)
    setError(null)

    const data = {
      name: name.trim(),
      instructions: content,
      description: ``,
      tools: [] as string[],
      triggerKeywords: [] as string[],
      alwaysActive: false,
    }

    let result: { data?: any; error?: Error } | undefined

    if (isEditMode && skill) {
      result = await updateSkill(orgId, skill.id, data)
    } else {
      result = await createSkill(orgId, data)
    }

    setLoading(false)

    if (result?.error) {
      const action = isEditMode ? `update` : `create`
      const msg = result.error?.message || `Please try again.`
      setError(`Failed to ${action} skill. ${msg}`)
    } else {
      if (!isEditMode && result?.data?.id) onCreated?.(result.data.id)
      onClose()
    }
  }

  const { actions } = useDrawerActions({
    onSave,
    onClose,
    onRemove: () => onRemove?.(skill),
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEditMode ? `Edit Skill` : `Create New Skill`}
      actions={
        <DrawerActions
          form='skill-form'
          actions={actions}
          loading={loading}
          disabled={loading}
          editing={isEditMode}
        />
      }
    >
      <form id='skill-form'>
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
            label='Skill Name'
            id='tdsk-skill-name-input'
            placeholder='Enter skill name'
            onChange={(e) => setName(e.target.value)}
          />

          <Code
            height='400px'
            value={content}
            disabled={loading}
            language='markdown'
            options={editorOpts}
            label='Skill Content'
            id='tdsk-skill-editor'
            onChange={onEditorChange}
            placeholder='Enter skill instructions in markdown...'
          />
        </Box>
      </form>
    </Drawer>
  )
}
