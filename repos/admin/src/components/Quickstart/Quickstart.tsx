import type { ComponentProps } from 'react'
import type { Button } from '@tdsk/components'
import type { SxProps, Theme } from '@mui/material'

import { toggleQuickStart } from '@TAF/actions/quickstart/local/toggle'
import { useQuickstartOpen, useActiveOrgId } from '@TAF/state/selectors'
import { QuickstartWizard } from '@TAF/components/Quickstart/QuickstartWizard'
import { QuickstartButton } from '@TAF/components/Quickstart/QuickstartButton'

export type TQuickstart = Pick<ComponentProps<typeof Button>, `variant` | `color`> & {
  button?: boolean
  buttonSx?: SxProps<Theme>
}

export const Quickstart = (props: TQuickstart) => {
  const [orgId] = useActiveOrgId()

  const { color, variant, buttonSx, button = true } = props

  const [wizardOpen] = useQuickstartOpen()

  return (
    <>
      {button && (
        <QuickstartButton
          sx={buttonSx}
          color={color}
          variant={variant}
        />
      )}
      {orgId && (
        <QuickstartWizard
          orgId={orgId}
          open={wizardOpen}
          onClose={() => toggleQuickStart(false)}
        />
      )}
    </>
  )
}
