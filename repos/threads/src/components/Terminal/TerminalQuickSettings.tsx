import { useState } from 'react'
import { nav } from '@TTH/services/nav'
import { resetTerminal } from '@TTH/actions/terminal/reset'
import { Settings as SettingsIcon } from '@mui/icons-material'
import { TerminalTabPanels } from '@TTH/components/Terminal/TerminalTabPanels'
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

export const TerminalQuickSettings = () => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const [tabIndex, setTabIndex] = useState(0)

  const ActivePanel = TerminalTabPanels[tabIndex].Component

  return (
    <>
      <IconButton
        size='small'
        title='Terminal Settings'
        onClick={(e) => setAnchorEl(e.currentTarget)}
      >
        <SettingsIcon fontSize='small' />
      </IconButton>
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: `bottom`, horizontal: `right` }}
        transformOrigin={{ vertical: `top`, horizontal: `right` }}
        slotProps={{
          paper: {
            sx: {
              width: 360,
              display: `flex`,
              maxHeight: `80vh`,
              overflow: `hidden`,
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
          variant='fullWidth'
          onChange={(_, v) => setTabIndex(v)}
          sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}
        >
          {TerminalTabPanels.map(({ label }) => (
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
            onClick={() => nav.settings()}
          >
            All Settings
          </Button>
        </Box>
      </Popover>
    </>
  )
}
