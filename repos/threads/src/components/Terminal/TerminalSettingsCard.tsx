import { useCallback } from 'react'
import { resetTerminal } from '@TTH/actions/terminal/reset'
import { Box, Card, Button, Divider, Typography, CardContent } from '@mui/material'
import { TerminalFontSettings } from '@TTH/components/Terminal/TerminalFontSettings'
import { TerminalThemeSettings } from '@TTH/components/Terminal/TerminalThemeSettings'
import { TerminalCursorSettings } from '@TTH/components/Terminal/TerminalCursorSettings'
import { TerminalScrollSettings } from '@TTH/components/Terminal/TerminalScrollSettings'

export const TerminalSettingsCard = () => {
  const onReset = useCallback(() => {
    resetTerminal()
  }, [])

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: `flex`, alignItems: `center`, mb: 1 }}>
          <Typography
            variant='h6'
            sx={{ flex: 1 }}
          >
            Terminal
          </Typography>
          <Button
            size='small'
            onClick={onReset}
            color='secondary'
          >
            Reset to Defaults
          </Button>
        </Box>

        <Divider sx={{ my: 2 }} />
        <Typography
          variant='subtitle2'
          sx={{ mb: 1.5 }}
        >
          Font
        </Typography>
        <TerminalFontSettings />

        <Divider sx={{ my: 2 }} />
        <Typography
          variant='subtitle2'
          sx={{ mb: 1.5 }}
        >
          Cursor
        </Typography>
        <TerminalCursorSettings />

        <Divider sx={{ my: 2 }} />
        <Typography
          variant='subtitle2'
          sx={{ mb: 1.5 }}
        >
          Scrollback & Scroll
        </Typography>
        <TerminalScrollSettings />

        <Divider sx={{ my: 2 }} />
        <Typography
          variant='subtitle2'
          sx={{ mb: 1.5 }}
        >
          Theme
        </Typography>
        <TerminalThemeSettings />
      </CardContent>
    </Card>
  )
}
