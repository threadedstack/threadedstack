import type { ComponentProps } from 'react'
import type { Button } from '@tdsk/components'
import type { SxProps, Theme } from '@mui/material'

import { toggleQuickStart } from '@TAF/actions/quickstart/local/toggle'
import { QuickstartWizard } from '@TAF/components/Quickstart/QuickstartWizard'
import { QuickstartButton } from '@TAF/components/Quickstart/QuickstartButton'
import { useQuickstartOpen, useActiveOrgId } from '@TAF/state/selectors'

export type TQuickstart = Pick<ComponentProps<typeof Button>, `variant` | `color`> & {
  button?: boolean
  buttonSx?: SxProps<Theme>
}

// TODO: move to Sidebar and Orgs page, should not be displayed on Homepage / Orgs List
export const Quickstart = (props: TQuickstart) => {
  const [orgId] = useActiveOrgId()

  const [wizardOpen] = useQuickstartOpen()
  const { color, variant, buttonSx, button = true } = props

  return orgId ? (
    <>
      {button && (
        <QuickstartButton
          sx={buttonSx}
          color={color}
          variant={variant}
        />
      )}
      {wizardOpen && orgId && (
        <QuickstartWizard
          orgId={orgId}
          open={wizardOpen}
          onClose={() => toggleQuickStart(false)}
        />
      )}
    </>
  ) : null
}
