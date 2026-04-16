import { Box, LinearProgress, Typography } from '@mui/material'

type TGuiProgressBarProps = {
  value: number
  max?: number
  label?: string
}

export function GuiProgressBar({ value, max = 100, label }: TGuiProgressBarProps) {
  const percent = Math.min(100, (value / max) * 100)

  return (
    <Box sx={{ my: 1 }}>
      {label && (
        <Typography
          variant='caption'
          color='text.secondary'
        >
          {label}
        </Typography>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinearProgress
          variant='determinate'
          value={percent}
          sx={{ flex: 1, height: 8, borderRadius: 4 }}
        />
        <Typography
          variant='caption'
          color='text.secondary'
        >
          {Math.round(percent)}%
        </Typography>
      </Box>
    </Box>
  )
}
