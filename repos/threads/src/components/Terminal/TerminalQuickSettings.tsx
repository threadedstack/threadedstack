import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import {
  Box,
  Tab,
  Tabs,
  Button,
  Divider,
  Popover,
  IconButton,
  Typography,
} from '@mui/material'

import { resetTerminal } from '@TTH/actions/terminal/reset'
import { TerminalFontSettings } from './TerminalFontSettings'
import { Settings as SettingsIcon } from '@mui/icons-material'
import { TerminalCursorSettings } from './TerminalCursorSettings'
import { TerminalScrollSettings } from './TerminalScrollSettings'
import { TerminalThemeSettings } from './TerminalThemeSettings'

const TabPanels = [
  { label: `Font`, Component: TerminalFontSettings },
  { label: `Cursor`, Component: TerminalCursorSettings },
  { label: `Scroll`, Component: TerminalScrollSettings },
  { label: `Theme`, Component: TerminalThemeSettings },
] as const

export const TerminalQuickSettings = () => {
  const navigate = useNavigate()
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const [tabIndex, setTabIndex] = useState(0)

  const handleOpen = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(e.currentTarget)
  }, [])

  const handleClose = useCallback(() => {
    setAnchorEl(null)
  }, [])

  const ActivePanel = TabPanels[tabIndex].Component

  return (
    <>
      <IconButton
        size='small'
        onClick={handleOpen}
        title='Terminal Settings'
      >
        <SettingsIcon fontSize='small' />
      </IconButton>
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: `bottom`, horizontal: `right` }}
        transformOrigin={{ vertical: `top`, horizontal: `right` }}
        slotProps={{
          paper: {
            sx: {
              width: 360,
              maxHeight: `80vh`,
              overflow: `hidden`,
              display: `flex`,
              flexDirection: `column`,
            },
          },
        }}
      >
        <Box sx={{ px: 2, pt: 1.5, pb: 0.5, display: `flex`, alignItems: `center` }}>
          <Typography
            variant='subtitle1'
            sx={{ flex: 1, fontWeight: 600 }}
          >
            Terminal Settings
          </Typography>
          <Button
            size='small'
            onClick={() => resetTerminal()}
            color='secondary'
          >
            Reset
          </Button>
        </Box>
        <Tabs
          value={tabIndex}
          onChange={(_, v) => setTabIndex(v)}
          variant='fullWidth'
          sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}
        >
          {TabPanels.map(({ label }) => (
            <Tab
              key={label}
              label={label}
            />
          ))}
        </Tabs>
        <Divider />
        <Box sx={{ p: 2, overflow: `auto`, flex: 1 }}>
          <ActivePanel />
        </Box>
        <Divider />
        <Box sx={{ p: 1, display: `flex`, justifyContent: `center` }}>
          <Button
            size='small'
            onClick={() => navigate(`/settings`)}
          >
            All Settings
          </Button>
        </Box>
      </Popover>
    </>
  )
}
