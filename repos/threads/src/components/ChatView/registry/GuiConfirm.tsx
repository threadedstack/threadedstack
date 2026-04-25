import type { TInteraction } from '@tdsk/domain'

import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'

type TGuiConfirmProps = {
  prompt: string
  yesLabel?: string
  noLabel?: string
  onAction?: (interaction: TInteraction) => void
}

export function GuiConfirm({
  prompt,
  yesLabel = `Yes`,
  noLabel = `No`,
  onAction,
}: TGuiConfirmProps) {
  const [decided, setDecided] = useState<boolean | null>(null)

  const handleClick = (approved: boolean) => {
    if (decided !== null) return
    setDecided(approved)
    onAction?.({ type: `YesNo`, approved })
  }

  return (
    <Box sx={{ my: 1 }}>
      <Typography
        variant={`body2`}
        sx={{ mb: 1 }}
      >
        {prompt}
      </Typography>
      <Box sx={{ display: `flex`, gap: 1 }}>
        <Button
          variant={`contained`}
          color={`success`}
          size={`small`}
          onClick={() => handleClick(true)}
          disabled={decided !== null}
          sx={{ opacity: decided === false ? 0.4 : 1, textTransform: `none` }}
        >
          {yesLabel}
        </Button>
        <Button
          variant={`outlined`}
          color={`error`}
          size={`small`}
          onClick={() => handleClick(false)}
          disabled={decided !== null}
          sx={{ opacity: decided === true ? 0.4 : 1, textTransform: `none` }}
        >
          {noLabel}
        </Button>
      </Box>
    </Box>
  )
}
