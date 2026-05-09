import type { TSandboxForm } from '@TAF/hooks/sandboxes/useSandboxForm'

import { isFeatureEnabled } from '@tdsk/domain'
import { SwitchInput } from '@tdsk/components'
import { GuiConfigForm } from '@TAF/components/GuiConfig/GuiConfigForm'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import {
  Box,
  Accordion,
  Typography,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

export type TSandboxGuiAccordionProps = {
  form: TSandboxForm
  toggleLabel: string
}

export const SandboxGuiAccordion = (props: TSandboxGuiAccordionProps) => {
  const { form, toggleLabel } = props

  if (!isFeatureEnabled('terminalGui')) return null

  return (
    <Accordion defaultExpanded={false}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          fontWeight={500}
          variant='subtitle1'
        >
          Generative UI
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <SwitchInput
            disabled={form.loading}
            checked={form.guiOverride}
            id='sandbox-gui-override'
            label={toggleLabel}
            onChange={(e, checked) => {
              form.setGuiOverride(checked)
              if (!checked) form.setSandboxGuiConfig(undefined)
            }}
          />
          <GuiConfigForm
            config={form.sandboxGuiConfig}
            onChange={form.setSandboxGuiConfig}
            disabled={form.loading || !form.guiOverride}
            orgProviders={form.orgProviders.map((p) => ({
              id: p.id,
              brand: p.brand,
              name: p.name || p.id,
            }))}
          />
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
