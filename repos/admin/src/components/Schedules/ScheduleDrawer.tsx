import type { Agent, Schedule } from '@tdsk/domain'

import Box from '@mui/material/Box'
import { useState, useEffect } from 'react'
import { cleanColl } from '@keg-hub/jsutils/cleanColl'
import { AgentSelector } from '@TAF/components/Selectors'
import { schedulesApi } from '@TAF/services/schedulesApi'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { FormSection } from '@TAF/components/FormSection/FormSection'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { Drawer, TextInput, SwitchInput, DrawerActions } from '@tdsk/components'

export type TScheduleDrawer = {
  open: boolean
  orgId?: string
  onClose: () => void
  schedule?: Schedule | null
  onSuccess?: () => void
  onRemove: (schedule: Schedule) => void
  agents?: Record<string, Agent>
}

type TTempSchedule = {
  prompt?: string
  agentId?: string
  enabled?: boolean
  createThread?: boolean
  cronExpression?: string
}

export const ScheduleDrawer = ({
  open,
  orgId,
  agents,
  schedule,
  onRemove,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TScheduleDrawer) => {
  const isEditMode = !!schedule
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [temp, setTemp] = useState<TTempSchedule>({
    enabled: true,
    createThread: true,
  })

  const updateTemp = (update: Partial<TTempSchedule>) => setTemp({ ...temp, ...update })

  useEffect(() => {
    if (schedule) {
      setTemp({
        agentId: schedule.agentId,
        cronExpression: schedule.cronExpression,
        prompt: schedule.prompt,
        enabled: schedule.enabled ?? true,
        createThread: schedule.createThread ?? true,
      })
      setError(null)
    } else {
      setError(null)
      setTemp({ enabled: true, createThread: true })
    }
  }, [schedule])

  const onClose = () => {
    if (loading) return

    onCloseCB?.()
    setError(null)
    setTemp({ enabled: true, createThread: true })
  }

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!temp?.agentId?.trim()) return setError(`Agent is required`)
    if (!temp?.cronExpression?.trim()) return setError(`Cron expression is required`)
    if (!temp?.prompt?.trim()) return setError(`Prompt is required`)

    setLoading(true)
    setError(null)

    const payload = cleanColl({
      agentId: temp.agentId,
      cronExpression: temp.cronExpression,
      prompt: temp.prompt,
      enabled: temp.enabled,
      createThread: temp.createThread,
    })

    let result: { error?: Error } | undefined

    if (isEditMode && schedule) {
      result = await schedulesApi.update(orgId, schedule.id, payload)
    } else {
      result = await schedulesApi.create(orgId, payload)
    }

    setLoading(false)

    if (result?.error) {
      const action = isEditMode ? `update` : `create`
      const msg = result.error?.message || `Please try again.`
      setError(`Failed to ${action} schedule. ${msg}`)
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

  const { actions } = useDrawerActions({
    onSave,
    onClose,
    onRemove: () => onRemove?.(schedule),
  })

  const agentsList = agents ? Object.values(agents) : []

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEditMode ? `Edit Schedule` : `Create New Schedule`}
      actions={
        <DrawerActions
          form='schedule-form'
          actions={actions}
          loading={loading}
          editing={isEditMode}
          disabled={loading}
        />
      }
    >
      <form id='schedule-form'>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && (
            <ErrorAlert
              message={error}
              onClose={() => setError(null)}
            />
          )}

          <AgentSelector
            required={true}
            loading={loading}
            agents={agentsList}
            agentId={temp?.agentId || ``}
            onChange={(id) => updateTemp({ agentId: id })}
          />

          <TextInput
            required
            fullWidth
            disabled={loading}
            label='Cron Expression'
            value={temp?.cronExpression || ``}
            id='tdsk-schedule-cron-input'
            placeholder='e.g. 0 9 * * 1-5 (weekdays at 9am)'
            onChange={(e) => updateTemp({ cronExpression: e.target.value })}
            sx={{ '& input': { fontFamily: 'monospace' } }}
          />

          <TextInput
            required
            textarea
            fullWidth
            minRows={4}
            disabled={loading}
            label='Prompt'
            value={temp?.prompt || ``}
            id='tdsk-schedule-prompt-input'
            placeholder='Enter the prompt to send to the agent on each run...'
            onChange={(e) => updateTemp({ prompt: e.target.value })}
          />

          <FormSection title='Schedule Options'>
            <SwitchInput
              disabled={loading}
              id='schedule-new-thread'
              label='New Thread Per Run'
              checked={temp?.createThread ?? true}
              onChange={(e) => updateTemp({ createThread: e.target.checked })}
            />

            <SwitchInput
              label='Enabled'
              disabled={loading}
              id='schedule-enabled'
              checked={temp?.enabled ?? true}
              onChange={(e) => updateTemp({ enabled: e.target.checked })}
            />
          </FormSection>
        </Box>
      </form>
    </Drawer>
  )
}
