import {
  Box,
  Slider,
  Select,
  MenuItem,
  Typography,
  FormControl,
  InputLabel,
} from '@mui/material'
import { useTerminalSettings } from '@TTH/state/selectors'
import { updateTerminal } from '@TTH/actions/terminal/update'
import { TerminalFontOptions, TerminalFontSizeRange } from '@TTH/constants/terminal'

export const TerminalFontSettings = () => {
  const [settings] = useTerminalSettings()

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2.5 }}>
      <FormControl
        size='small'
        fullWidth
      >
        <InputLabel>Font Family</InputLabel>
        <Select
          value={settings.fontFamily}
          label='Font Family'
          onChange={(e) => updateTerminal({ fontFamily: e.target.value })}
        >
          {TerminalFontOptions.map((opt) => (
            <MenuItem
              key={opt.value}
              value={opt.value}
              sx={{ fontFamily: opt.value }}
            >
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box>
        <Typography
          variant='body2'
          gutterBottom
        >
          Font Size: {settings.fontSize}px
        </Typography>
        <Slider
          value={settings.fontSize}
          min={TerminalFontSizeRange.min}
          max={TerminalFontSizeRange.max}
          step={TerminalFontSizeRange.step}
          onChange={(_, val) => updateTerminal({ fontSize: val as number })}
          valueLabelDisplay='auto'
        />
      </Box>
    </Box>
  )
}
