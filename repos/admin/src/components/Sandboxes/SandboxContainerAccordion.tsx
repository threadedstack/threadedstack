import type { TSandboxForm } from '@TAF/hooks/sandboxes/useSandboxForm'
import type { TImagePullPolicy } from '@tdsk/domain'

import { SBImagePullPolicyOptions } from '@tdsk/domain'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
import { TextInput, SelectInput } from '@tdsk/components'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import {
  Box,
  Accordion,
  Typography,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

export type TSandboxContainerAccordionProps = {
  form: TSandboxForm
  envVarsLabel?: string
  portsLabel?: string
  workdirHelperText?: string
}

export const SandboxContainerAccordion = (props: TSandboxContainerAccordionProps) => {
  const {
    form,
    envVarsLabel = 'Environment Variables',
    portsLabel = 'Ports',
    workdirHelperText,
  } = props

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          fontWeight={500}
          variant='subtitle1'
        >
          Container
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {form.isCustomRuntime && (
            <>
              <TextInput
                required
                fullWidth
                value={form.image}
                id='sandbox-image'
                disabled={form.loading}
                label='Container Image'
                placeholder='e.g. node:20-slim'
                onChange={(e) => form.setImage(e.target.value)}
              />
              <SelectInput
                id='sandbox-pull-policy'
                label='Image Pull Policy'
                value={form.imagePullPolicy}
                items={SBImagePullPolicyOptions}
                disabled={form.loading}
                onChange={(e) =>
                  form.setImagePullPolicy(e.target.value as TImagePullPolicy)
                }
              />
            </>
          )}

          <TextInput
            fullWidth
            value={form.workdir}
            disabled={form.loading}
            placeholder='/workspace'
            id='sandbox-workdir'
            label='Working Directory'
            helperText={workdirHelperText}
            onChange={(e) => form.setWorkdir(e.target.value)}
          />

          <TextInput
            fullWidth
            value={form.command}
            label='Command'
            disabled={form.loading}
            id='sandbox-command'
            placeholder='Comma-separated, e.g. /bin/sh, -c'
            onChange={(e) => form.setCommand(e.target.value)}
          />

          <TextInput
            fullWidth
            value={form.args}
            label='Args'
            id='sandbox-args'
            disabled={form.loading}
            placeholder='Comma-separated'
            onChange={(e) => form.setArgs(e.target.value)}
          />

          <KeyValueEditor
            label={envVarsLabel}
            pairs={form.envVars}
            disabled={form.loading}
            secrets={form.allSecrets}
            onChange={form.setEnvVars}
            enableSecretReferences={true}
            keyPlaceholder='Variable Name'
            valuePlaceholder='Value or {{secret-name}}'
          />

          <KeyValueEditor
            label={portsLabel}
            pairs={form.ports}
            disabled={form.loading}
            onChange={form.setPorts}
            enableSecretReferences={false}
            keyPlaceholder='Port Number (e.g. 3000)'
            valuePlaceholder='Protocol (http/https)'
          />
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
