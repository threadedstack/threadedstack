import type { TSandboxSchedule } from '@TAF/types'
import type { Schedule, Sandbox } from '@tdsk/domain'

import Box from '@mui/material/Box'
import { useState, useEffect } from 'react'
import Accordion from '@mui/material/Accordion'
import Typography from '@mui/material/Typography'
import { DefaultTemp } from '@TAF/constants/schedule'
import ToggleButton from '@mui/material/ToggleButton'
import { cleanColl } from '@keg-hub/jsutils/cleanColl'
import { EScheduleType, isFeatureEnabled } from '@tdsk/domain'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useOrgAgents, useProjectSandboxes } from '@TAF/state/selectors'
import { AgentSelector, SandboxSelector } from '@TAF/components/Selectors'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { FormSection } from '@TAF/components/FormSection/FormSection'
import { ScheduleRuns } from '@TAF/components/Schedules/ScheduleRuns'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { createSchedule } from '@TAF/actions/schedules/api/createSchedule'
import { updateSchedule } from '@TAF/actions/schedules/api/updateSchedule'
import {
  Drawer,
  CronInput,
  TextInput,
  SwitchInput,
  DrawerActions,
} from '@tdsk/components'

export type TScheduleDrawer = {
  open: boolean
  orgId?: string
  projectId?: string
  onClose: () => void
  schedule?: Schedule | null
  onRemove: (schedule: Schedule) => void
}

export const ScheduleDrawer = ({
  open,
  orgId,
  projectId,
  schedule,
  onRemove,
  onClose: onCloseCB,
}: TScheduleDrawer) => {
  const isEditMode = !!schedule
  const [loading, setLoading] = useState(false)
  const [cronError, setCronError] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [temp, setTemp] = useState<TSandboxSchedule>(DefaultTemp)

  const [projectSandboxes] = useProjectSandboxes()
  const sandboxes = projectSandboxes ? Object.values(projectSandboxes) : []

  const [orgAgents] = useOrgAgents()
  const agents = orgAgents ? Object.values(orgAgents) : []

  const updateTemp = (update: Partial<TSandboxSchedule>) =>
    setTemp({ ...temp, ...update })

  useEffect(() => {
    if (schedule) {
      setTemp({
        prompt: schedule.prompt,
        agentId: schedule.agentId,
        command: schedule.command,
        sandboxId: schedule.sandboxId,
        enabled: schedule.enabled ?? true,
        cronExpression: schedule.cronExpression,
        type: schedule.type || EScheduleType.prompt,
      })
      setError(null)
    } else {
      setError(null)
      setTemp(DefaultTemp)
    }
  }, [schedule])

  const onClose = () => {
    if (loading) return

    onCloseCB?.()
    setError(null)
    setTemp(DefaultTemp)
  }

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!orgId || !projectId) return setError(`Organization and project are required`)
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
      agentId: temp.agentId,
      sandboxId: temp.sandboxId,
      cronExpression: temp.cronExpression,
      prompt: temp.type === EScheduleType.prompt ? temp.prompt : undefined,
      command: temp.type === EScheduleType.shell ? temp.command : undefined,
    })

    // cleanColl strips undefined keys, so explicitly send null to clear an existing agent
    if (isEditMode && schedule?.agentId && !temp.agentId) payload.agentId = null

    const result =
      isEditMode && schedule
        ? await updateSchedule(orgId, projectId, schedule.id, payload)
        : await createSchedule(orgId, projectId, payload)

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
          disabled={loading || cronError}
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

          {isEditMode && (
            <SwitchInput
              label='Enabled'
              disabled={loading}
              id='schedule-enabled'
              checked={temp?.enabled ?? true}
              onChange={(e) => updateTemp({ enabled: e.target.checked })}
            />
          )}

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                fontWeight={500}
                variant='subtitle1'
              >
                Configuration
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <SandboxSelector
                  required
                  loading={loading}
                  sandboxes={sandboxes as Sandbox[]}
                  sandboxId={temp?.sandboxId || ``}
                  onChange={(id) => updateTemp({ sandboxId: id })}
                />

                {isFeatureEnabled(`agents`) && (
                  <AgentSelector
                    allowNone
                    agents={agents}
                    loading={loading}
                    agentId={temp?.agentId || ``}
                    onChange={(id) => updateTemp({ agentId: id || undefined })}
                  />
                )}

                {temp.type === EScheduleType.prompt && (
                  <TextInput
                    required
                    textarea
                    fullWidth
                    minRows={4}
                    label='Prompt'
                    disabled={loading}
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
              </Box>
            </AccordionDetails>
          </Accordion>

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                fontWeight={500}
                variant='subtitle1'
              >
                Cron Schedule
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <CronInput
                hideDates
                showCron
                disabled={loading}
                value={temp?.cronExpression || ``}
                onChange={(_e, change) => {
                  setCronError(!!change.error)
                  updateTemp({ cronExpression: change.value })
                }}
              />
            </AccordionDetails>
          </Accordion>

          {isEditMode && schedule && <ScheduleRuns scheduleId={schedule.id} />}
        </Box>
      </form>
    </Drawer>
  )
}
