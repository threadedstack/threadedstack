import type { Schedule, Sandbox } from '@tdsk/domain'

import Box from '@mui/material/Box'
import { useState, useEffect } from 'react'
import { EScheduleType } from '@tdsk/domain'
import ToggleButton from '@mui/material/ToggleButton'
import { cleanColl } from '@keg-hub/jsutils/cleanColl'
import { useOrgSandboxes } from '@TAF/state/selectors'
import { SandboxSelector } from '@TAF/components/Selectors'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { FormSection } from '@TAF/components/FormSection/FormSection'
import { ScheduleRuns } from '@TAF/components/Schedules/ScheduleRuns'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { createSchedule } from '@TAF/actions/schedules/api/createSchedule'
import { updateSchedule } from '@TAF/actions/schedules/api/updateSchedule'
import {
  Drawer,
  TextInput,
  SwitchInput,
  DrawerActions,
  CronInput,
} from '@tdsk/components'

export type TScheduleDrawer = {
  open: boolean
  orgId?: string
  onClose: () => void
  schedule?: Schedule | null
  onRemove: (schedule: Schedule) => void
}

type TTempSchedule = {
  type?: string
  prompt?: string
  command?: string
  sandboxId?: string
  enabled?: boolean
  createThread?: boolean
  cronExpression?: string
}

export const ScheduleDrawer = ({
  open,
  orgId,
  schedule,
  onRemove,
  onClose: onCloseCB,
}: TScheduleDrawer) => {
  const isEditMode = !!schedule
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const defaultTemp: TTempSchedule = {
    enabled: true,
    createThread: true,
    type: EScheduleType.prompt,
    cronExpression: `0 0 * * 6`,
  }

  const [temp, setTemp] = useState<TTempSchedule>(defaultTemp)

  const [orgSandboxes] = useOrgSandboxes()
  const sandboxes = orgSandboxes ? Object.values(orgSandboxes) : []

  const updateTemp = (update: Partial<TTempSchedule>) => setTemp({ ...temp, ...update })

  useEffect(() => {
    if (schedule) {
      setTemp({
        prompt: schedule.prompt,
        command: schedule.command,
        sandboxId: schedule.sandboxId,
        enabled: schedule.enabled ?? true,
        cronExpression: schedule.cronExpression,
        type: schedule.type || EScheduleType.prompt,
        createThread: schedule.createThread ?? true,
      })
      setError(null)
    } else {
      setError(null)
      setTemp(defaultTemp)
    }
  }, [schedule])

  const onClose = () => {
    if (loading) return

    onCloseCB?.()
    setError(null)
    setTemp({ type: EScheduleType.prompt, enabled: true, createThread: true })
  }

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!temp?.sandboxId?.trim()) return setError(`Sandbox is required`)
    if (!temp?.cronExpression?.trim()) return setError(`Cron expression is required`)

    if (temp.type === EScheduleType.prompt && !temp?.prompt?.trim())
      return setError(`Prompt is required`)

    if (temp.type === EScheduleType.shell && !temp?.command?.trim())
      return setError(`Command is required`)

    setLoading(true)
    setError(null)

    const payload = cleanColl({
      type: temp.type,
      enabled: temp.enabled,
      sandboxId: temp.sandboxId,
      createThread: temp.createThread,
      cronExpression: temp.cronExpression,
      prompt: temp.type === EScheduleType.prompt ? temp.prompt : undefined,
      command: temp.type === EScheduleType.shell ? temp.command : undefined,
    })

    const result =
      isEditMode && schedule
        ? await updateSchedule(orgId, schedule.id, payload)
        : await createSchedule(orgId, payload)

    setLoading(false)

    if (result?.error) {
      const action = isEditMode ? `update` : `create`
      const msg = result.error?.message || `Please try again.`
      setError(`Failed to ${action} schedule. ${msg}`)
    } else {
      onClose()
    }
  }

  const { actions } = useDrawerActions({
    onSave,
    onClose,
    onRemove: () => onRemove?.(schedule),
  })

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

          <FormSection title='Job Type'>
            <ToggleButtonGroup
              exclusive
              size='small'
              value={temp.type || EScheduleType.prompt}
              onChange={(_, val) => val && updateTemp({ type: val })}
            >
              <ToggleButton value={EScheduleType.prompt}>AI Prompt</ToggleButton>
              <ToggleButton value={EScheduleType.shell}>Shell Command</ToggleButton>
            </ToggleButtonGroup>
          </FormSection>

          <SandboxSelector
            required
            loading={loading}
            sandboxes={sandboxes as Sandbox[]}
            sandboxId={temp?.sandboxId || ``}
            onChange={(id) => updateTemp({ sandboxId: id })}
          />

          <FormSection title='Schedule'>
            <CronInput
              hideDates
              showCron
              disabled={loading}
              value={temp?.cronExpression || ``}
              onChange={(_e, change) => updateTemp({ cronExpression: change.value })}
            />
          </FormSection>

          {temp.type === EScheduleType.prompt && (
            <TextInput
              required
              textarea
              fullWidth
              minRows={4}
              disabled={loading}
              label='Prompt'
              value={temp?.prompt || ``}
              id='tdsk-schedule-prompt-input'
              placeholder='Enter the prompt to send on each run...'
              onChange={(e) => updateTemp({ prompt: e.target.value })}
            />
          )}

          {temp.type === EScheduleType.shell && (
            <TextInput
              required
              textarea
              fullWidth
              minRows={4}
              label='Command'
              disabled={loading}
              value={temp?.command || ``}
              id='tdsk-schedule-command-input'
              sx={{ '& textarea': { fontFamily: 'monospace' } }}
              placeholder='Enter the shell command to execute on each run...'
              onChange={(e) => updateTemp({ command: e.target.value })}
            />
          )}

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

          {isEditMode && orgId && schedule && (
            <ScheduleRuns
              orgId={orgId}
              scheduleId={schedule.id}
            />
          )}
        </Box>
      </form>
    </Drawer>
  )
}
