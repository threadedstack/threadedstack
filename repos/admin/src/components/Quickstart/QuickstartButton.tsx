import type { ComponentProps } from 'react'

import { Button } from '@tdsk/components'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import { toggleQuickStart } from '@TAF/actions/quickstart/local/toggle'

export type TQuickstartButton = ComponentProps<typeof Button>

export const QuickstartButton = (props: TQuickstartButton) => {
  const { sx, variant = `text`, color = `primary`, text = `Quick Start` } = props

  return (
    <Button
      sx={sx}
      text={text}
      color={color}
      variant={variant}
      Icon={RocketLaunchIcon}
      onClick={() => toggleQuickStart(true)}
    />
  )
}
