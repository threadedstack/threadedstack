import {
  Box,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  FormControlLabel,
} from '@mui/material'
import { useTerminalSettings } from '@TTH/state/selectors'
import { updateTerminal } from '@TTH/actions/terminal/update'
import { TerminalCursorStyles } from '@TTH/constants/terminal'

export const TerminalCursorSettings = () => {
  const [settings] = useTerminalSettings()

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
      <Box>
        <Typography
          variant='body2'
          gutterBottom
        >
          Cursor Style
        </Typography>
        <ToggleButtonGroup
          value={settings.cursorStyle}
          exclusive
          onChange={(_, val) => {
            if (val) updateTerminal({ cursorStyle: val })
          }}
          size='small'
        >
          {TerminalCursorStyles.map((opt) => (
            <ToggleButton
              key={opt.value}
              value={opt.value}
            >
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <FormControlLabel
        label='Cursor Blink'
        control={
          <Switch
            checked={settings.cursorBlink}
            onChange={(e) => updateTerminal({ cursorBlink: e.target.checked })}
          />
        }
      />
    </Box>
  )
}
