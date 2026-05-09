import type { ReactNode } from 'react'
import type { TSandboxForm } from '@TAF/hooks/sandboxes/useSandboxForm'
import type { TSandboxRuntimeId } from '@tdsk/domain'

import { Code } from '@TAF/components/Code/Code'
import { MonacoOptions } from '@TAF/constants/monaco'
import { SandboxRuntimeOptions } from '@tdsk/domain'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { TextInput, SelectInput, SwitchInput } from '@tdsk/components'
import {
  Box,
  Accordion,
  Typography,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

export type TSandboxConfigAccordionProps = {
  form: TSandboxForm
  initScriptHelperText?: ReactNode
  children?: ReactNode
}

export const SandboxConfigAccordion = (props: TSandboxConfigAccordionProps) => {
  const { form, initScriptHelperText, children } = props

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          fontWeight={500}
          variant='subtitle1'
        >
          Sandbox
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <SelectInput
            id='sandbox-preset'
            label='Presets'
            value={form.runtime}
            items={SandboxRuntimeOptions}
            disabled={form.loading}
            onChange={(e) => form.applyPreset(e.target.value as TSandboxRuntimeId)}
          />

          {children}

          <TextInput
            fullWidth
            disabled={!form.isCustomRuntime || form.loading}
            id='sandbox-runtime-command'
            label='Runtime Command'
            placeholder={form.isCustomRuntime ? `e.g. my-ai-tool` : ``}
            value={form.isCustomRuntime ? form.runtimeCommand : form.resolvedRuntimeCmd}
            onChange={(e) => form.setRuntimeCommand(e.target.value)}
            helperText={
              !form.isCustomRuntime
                ? `Pre-configured for ${SandboxRuntimeOptions.find((o) => o.value === form.runtime)?.label || form.runtime}`
                : undefined
            }
          />

          <TextInput
            fullWidth
            type='number'
            placeholder='30'
            disabled={form.loading}
            id='sandbox-idle-timeout'
            label='Idle timeout (minutes)'
            value={String(form.idleTimeoutMinutes)}
            onChange={(e) => form.setIdleTimeoutMinutes(Number(e.target.value))}
          />

          <Box>
            <Typography
              variant='caption'
              color='text.secondary'
              sx={{ mb: 0.5, display: 'block' }}
            >
              Init Script
              {initScriptHelperText && (
                <Typography
                  component='span'
                  variant='caption'
                  color='text.secondary'
                  sx={{ ml: 1 }}
                >
                  {initScriptHelperText}
                </Typography>
              )}
            </Typography>
            <Code
              id='sandbox-init-script'
              language='shell'
              disabled={form.loading}
              options={MonacoOptions}
              defaultValue={
                form.initScript || (!form.isCustomRuntime ? form.resolvedInitScript : ``)
              }
              label=''
              onChange={(value) => form.setInitScript(value || ``)}
              sx={{ minHeight: 120 }}
            />
          </Box>
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
