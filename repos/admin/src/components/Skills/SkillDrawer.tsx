import type { Skill } from '@tdsk/domain'
import { useState, useEffect } from 'react'
import { cleanColl } from '@keg-hub/jsutils/cleanColl'
import { skillsApi } from '@TAF/services/skillsApi'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { Drawer, TextInput, DrawerActions } from '@tdsk/components'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { Box, Switch, FormControlLabel } from '@mui/material'

export type TSkillDrawer = {
  open: boolean
  orgId?: string
  onClose: () => void
  skill?: Skill | null
  onSuccess?: () => void
  onRemove?: (skill: Skill) => void
}

type TTempSkill = {
  name?: string
  description?: string
  instructions?: string
  tools?: string
  triggerKeywords?: string
  alwaysActive?: boolean
}

export const SkillDrawer = ({
  open,
  orgId,
  skill,
  onRemove,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TSkillDrawer) => {
  const isEditMode = !!skill
  const [loading, setLoading] = useState(false)
  const [temp, setTemp] = useState<TTempSkill>({})
  const [error, setError] = useState<string | null>(null)

  const updateTemp = (update: Partial<TTempSkill>) => setTemp({ ...temp, ...update })

  useEffect(() => {
    if (skill) {
      setTemp({
        name: skill.name,
        description: skill.description,
        instructions: skill.instructions,
        tools: skill.tools?.join(', ') || '',
        triggerKeywords: skill.triggerKeywords?.join(', ') || '',
        alwaysActive: skill.alwaysActive ?? false,
      })
      setError(null)
    } else {
      setError(null)
      setTemp({})
    }
  }, [skill])

  const onClose = () => {
    if (loading) return

    onCloseCB?.()
    setError(null)
    setTemp({})
  }

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!temp.name?.trim()) return setError(`Skill name is required`)
    if (!orgId) return setError(`Organization is required`)

    setLoading(true)
    setError(null)

    const tools =
      temp.tools
        ?.split(',')
        .map((t) => t.trim())
        .filter(Boolean) || []

    const triggerKeywords =
      temp.triggerKeywords
        ?.split(',')
        .map((k) => k.trim())
        .filter(Boolean) || []

    const data = cleanColl({
      name: temp.name,
      description: temp.description,
      instructions: temp.instructions,
      tools,
      triggerKeywords,
      alwaysActive: temp.alwaysActive,
    })

    let result: { error?: Error } | undefined

    if (isEditMode && skill) {
      result = await skillsApi.update(orgId, skill.id, data)
    } else {
      result = await skillsApi.create(orgId, data)
    }

    setLoading(false)

    if (result?.error) {
      const action = isEditMode ? `update` : `create`
      const msg = result.error?.message || `Please try again.`
      setError(`Failed to ${action} skill. ${msg}`)
    } else {
      onSuccessCB?.()
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
          editing={isEditMode}
          disabled={loading}
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
            disabled={loading}
            label='Skill Name'
            value={temp?.name || ``}
            id='tdsk-skill-name-input'
            placeholder='Enter skill name'
            onChange={(e) => updateTemp({ name: e.target.value })}
          />

          <TextInput
            textarea
            fullWidth
            minRows={3}
            disabled={loading}
            label='Description'
            value={temp?.description || ``}
            id='tdsk-skill-description-input'
            placeholder='Enter description (optional)'
            onChange={(e) => updateTemp({ description: e.target.value })}
          />

          <TextInput
            textarea
            fullWidth
            minRows={6}
            disabled={loading}
            label='Instructions'
            value={temp?.instructions || ``}
            id='tdsk-skill-instructions-input'
            placeholder='Enter skill instructions (optional)'
            onChange={(e) => updateTemp({ instructions: e.target.value })}
          />

          <TextInput
            fullWidth
            disabled={loading}
            label='Tools'
            value={temp?.tools || ``}
            id='tdsk-skill-tools-input'
            placeholder='Comma-separated tool names (optional)'
            onChange={(e) => updateTemp({ tools: e.target.value })}
          />

          <TextInput
            fullWidth
            disabled={loading}
            label='Trigger Keywords'
            value={temp?.triggerKeywords || ``}
            id='tdsk-skill-trigger-keywords-input'
            placeholder='Comma-separated keywords (optional)'
            onChange={(e) => updateTemp({ triggerKeywords: e.target.value })}
          />

          <FormControlLabel
            control={
              <Switch
                checked={temp?.alwaysActive ?? false}
                disabled={loading}
                onChange={(e) => updateTemp({ alwaysActive: e.target.checked })}
              />
            }
            label='Always Active'
          />
        </Box>
      </form>
    </Drawer>
  )
}
