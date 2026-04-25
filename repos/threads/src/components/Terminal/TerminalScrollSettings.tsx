import { Box, Slider, Typography } from '@mui/material'
import { useTerminalSettings } from '@TTH/state/selectors'
import { updateTerminal } from '@TTH/actions/terminal/update'
import {
  TerminalScrollbackRange,
  TerminalSmoothScrollRange,
} from '@TTH/constants/terminal'

export const TerminalScrollSettings = () => {
  const [settings] = useTerminalSettings()

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2.5 }}>
      <Box>
        <Typography
          variant='body2'
          gutterBottom
        >
          Scrollback Lines: {settings.scrollback.toLocaleString()}
        </Typography>
        <Slider
          value={settings.scrollback}
          min={TerminalScrollbackRange.min}
          max={TerminalScrollbackRange.max}
          step={TerminalScrollbackRange.step}
          onChange={(_, val) => updateTerminal({ scrollback: val as number })}
          valueLabelDisplay='auto'
          valueLabelFormat={(v) => `${(v / 1000).toFixed(0)}k`}
        />
        <Typography
          variant='caption'
          color='text.secondary'
        >
          Takes effect on next session start
        </Typography>
      </Box>

      <Box>
        <Typography
          variant='body2'
          gutterBottom
        >
          Smooth Scroll: {settings.smoothScrollDuration}ms
        </Typography>
        <Slider
          value={settings.smoothScrollDuration}
          min={TerminalSmoothScrollRange.min}
          max={TerminalSmoothScrollRange.max}
          step={TerminalSmoothScrollRange.step}
          onChange={(_, val) => updateTerminal({ smoothScrollDuration: val as number })}
          valueLabelDisplay='auto'
          valueLabelFormat={(v) => (v === 0 ? `Off` : `${v}ms`)}
        />
      </Box>
    </Box>
  )
}
