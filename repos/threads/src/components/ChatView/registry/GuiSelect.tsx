import type { TInteraction } from '@tdsk/domain'

import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'

type TOption = { label: string; value: string; description?: string }

type TGuiSelectProps = {
  options: TOption[]
  interactionType: `ArrowSelect` | `NumberSelect`
  currentIndex?: number
  onAction?: (interaction: TInteraction) => void
}

export function GuiSelect({
  options,
  interactionType,
  currentIndex = 0,
  onAction,
}: TGuiSelectProps) {
  const [selected, setSelected] = useState<number | null>(null)

  const handleClick = (index: number) => {
    if (selected !== null) return
    setSelected(index)
    onAction?.(
      interactionType === `ArrowSelect`
        ? { type: `ArrowSelect`, selectedIndex: index, currentIndex }
        : { type: `NumberSelect`, selectedIndex: index }
    )
  }

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1, my: 1 }}>
      {options.map((opt, i) => (
        <Button
          key={i}
          variant={`outlined`}
          onClick={() => handleClick(i)}
          disabled={selected !== null}
          sx={{
            justifyContent: `flex-start`,
            textTransform: `none`,
            opacity: selected !== null && selected !== i ? 0.4 : 1,
            borderColor: selected === i ? `primary.main` : `divider`,
            bgcolor: selected === i ? `action.selected` : `transparent`,
          }}
        >
          <Box>
            <Typography
              variant={`body2`}
              fontWeight={500}
            >
              {opt.label}
            </Typography>
            {opt.description && (
              <Typography
                variant={`caption`}
                color={`text.secondary`}
              >
                {opt.description}
              </Typography>
            )}
          </Box>
        </Button>
      ))}
    </Box>
  )
}
