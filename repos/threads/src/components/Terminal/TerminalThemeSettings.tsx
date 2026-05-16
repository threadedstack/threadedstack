import type { ITheme } from '@xterm/xterm'
import type { TTerminalThemePreset } from '@TTH/types'

import { useState, useCallback } from 'react'
import { useTerminalSettings } from '@TTH/state/selectors'
import { ExpandMore, ExpandLess } from '@mui/icons-material'
import { updateTerminal } from '@TTH/actions/terminal/update'
import {
  TerminalThemePresets,
  TerminalThemeColorFields,
  TerminalThemePresetLabels,
} from '@TTH/constants/terminal'
import {
  Box,
  Select,
  MenuItem,
  Collapse,
  Typography,
  IconButton,
  FormControl,
  InputLabel,
} from '@mui/material'

const ColorSwatch = ({
  color,
  label,
  onChange,
}: {
  color: string
  label: string
  onChange: (color: string) => void
}) => (
  <Box sx={{ display: `flex`, alignItems: `center`, gap: 1, minWidth: 160 }}>
    <Box
      component='input'
      type='color'
      value={color}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      sx={{
        width: 28,
        height: 28,
        padding: 0,
        border: `1px solid`,
        borderColor: `divider`,
        borderRadius: 0.5,
        cursor: `pointer`,
        '&::-webkit-color-swatch-wrapper': { padding: 0 },
        '&::-webkit-color-swatch': { border: `none`, borderRadius: 0.5 },
      }}
    />
    <Typography
      variant='caption'
      noWrap
    >
      {label}
    </Typography>
  </Box>
)

export const TerminalThemeSettings = () => {
  const [settings] = useTerminalSettings()
  const [colorsExpanded, setColorsExpanded] = useState(false)

  const handlePresetChange = useCallback((preset: TTerminalThemePreset) => {
    if (preset === `custom`) {
      updateTerminal({ themePreset: `custom` })
      return
    }
    const theme = TerminalThemePresets[preset]
    updateTerminal({ themePreset: preset, theme })
  }, [])

  const handleColorChange = useCallback(
    (key: string, color: string) => {
      const updatedTheme: ITheme = { ...settings.theme, [key]: color }
      updateTerminal({ themePreset: `custom`, theme: updatedTheme })
    },
    [settings.theme]
  )

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
      <FormControl
        size='small'
        fullWidth
      >
        <InputLabel>Theme Preset</InputLabel>
        <Select
          value={settings.themePreset}
          label='Theme Preset'
          onChange={(e) => handlePresetChange(e.target.value as TTerminalThemePreset)}
        >
          {Object.entries(TerminalThemePresetLabels).map(([value, label]) => (
            <MenuItem
              key={value}
              value={value}
            >
              <Box sx={{ display: `flex`, alignItems: `center`, gap: 1 }}>
                {value !== `custom` && (
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: 0.5,
                      bgcolor:
                        TerminalThemePresets[value as keyof typeof TerminalThemePresets]
                          ?.background,
                      border: `1px solid`,
                      borderColor: `divider`,
                    }}
                  />
                )}
                {label}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box
        sx={{
          display: `flex`,
          gap: 0.25,
          p: 0.5,
          borderRadius: 1,
          bgcolor: settings.theme.background,
          border: `1px solid`,
          borderColor: `divider`,
        }}
      >
        {[`black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`].map(
          (key) => (
            <Box
              key={key}
              sx={{
                flex: 1,
                height: 12,
                borderRadius: 0.25,
                bgcolor: settings.theme[key as keyof ITheme],
              }}
            />
          )
        )}
      </Box>

      <Box
        sx={{ display: `flex`, alignItems: `center`, cursor: `pointer` }}
        onClick={() => setColorsExpanded((v) => !v)}
      >
        <Typography
          variant='body2'
          sx={{ flex: 1 }}
        >
          Individual Colors
        </Typography>
        <IconButton size='small'>
          {colorsExpanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>

      <Collapse in={colorsExpanded}>
        <Box
          sx={{
            display: `grid`,
            gridTemplateColumns: `repeat(auto-fill, minmax(180px, 1fr))`,
            gap: 1.5,
            pt: 1,
          }}
        >
          {TerminalThemeColorFields.map(({ key, label }) => (
            <ColorSwatch
              key={key}
              color={(settings.theme[key as keyof ITheme] as string) || `#000000`}
              label={label}
              onChange={(color) => handleColorChange(key, color)}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}
