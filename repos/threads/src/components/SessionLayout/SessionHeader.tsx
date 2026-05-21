import type { TOpenSession } from '@TTH/types'

import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import Info from '@mui/icons-material/Info'
import { shortId } from '@TTH/utils/shortId'
import Logout from '@mui/icons-material/Logout'
import { MonoFont } from '@TTH/constants/values'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Terminal from '@mui/icons-material/Terminal'
import IosShare from '@mui/icons-material/IosShare'
import OpenInNew from '@mui/icons-material/OpenInNew'
import RestartAlt from '@mui/icons-material/RestartAlt'
import { PillMono, StatusChip } from '@TTH/components/PagePrimitives'

export type TSessionHeader = {
  isOwner: boolean
  onShare: () => void
  onDetach: () => void
  onRestart: () => void
  session: TOpenSession
  onEndSession: () => void
  contextPanelOpen: boolean
  onToggleContext: () => void
}

export const SessionHeader = (props: TSessionHeader) => {
  const {
    session,
    isOwner,
    onShare,
    onDetach,
    onRestart,
    onEndSession,
    onToggleContext,
    contextPanelOpen,
  } = props

  const sessionName = session.runtime || `Session`
  const idLabel = shortId(session.sessionId, `s`)

  const metadataLine = useMemo(() => {
    const parts: string[] = []
    if (session.runtime) parts.push(session.runtime)
    parts.push(`shell`)
    return parts.join(` · `)
  }, [session.runtime])

  return (
    <Box
      sx={{
        gap: `14px`,
        minHeight: 56,
        borderBottom: 1,
        display: `flex`,
        padding: `12px 18px`,
        alignItems: `center`,
        borderColor: `divider`,
      }}
    >
      <Terminal sx={{ fontSize: 22, color: `primary.main`, flexShrink: 0 }} />
      <Box sx={{ display: `flex`, flexDirection: `column`, minWidth: 0, flex: 1 }}>
        <Box sx={{ display: `flex`, alignItems: `center`, gap: 1 }}>
          <Typography
            noWrap
            sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}
          >
            {sessionName}
          </Typography>
          <PillMono>{idLabel}</PillMono>
          <StatusChip
            status='active'
            size='sm'
          />
        </Box>
        <Typography
          noWrap
          sx={{
            fontSize: 11,
            color: `text.secondary`,
            lineHeight: 1.3,
            fontFamily: MonoFont,
          }}
        >
          {metadataLine}
        </Typography>
      </Box>
      <Box sx={{ display: `flex`, alignItems: `center`, gap: 0.5, flexShrink: 0 }}>
        {isOwner && (
          <Tooltip title='Detach'>
            <IconButton
              size='small'
              onClick={onDetach}
            >
              <OpenInNew sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
        {isOwner && (
          <Tooltip title='Restart'>
            <IconButton
              size='small'
              onClick={onRestart}
            >
              <RestartAlt sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title='Share'>
          <IconButton
            size='small'
            onClick={onShare}
          >
            <IosShare sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={contextPanelOpen ? `Hide info panel` : `Show info panel`}>
          <IconButton
            size='small'
            onClick={onToggleContext}
            sx={{
              ...(contextPanelOpen && {
                color: `primary.main`,
                border: 1,
                borderColor: `primary.main`,
              }),
            }}
          >
            <Info sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Box
          sx={{
            width: `1px`,
            height: 22,
            bgcolor: `divider`,
            mx: 0.5,
            flexShrink: 0,
          }}
        />
        <Button
          size='small'
          variant='outlined'
          color='error'
          onClick={onEndSession}
          startIcon={<Logout sx={{ fontSize: 16 }} />}
          sx={{ textTransform: `none`, minWidth: 0, px: 1.5 }}
        >
          End
        </Button>
      </Box>
    </Box>
  )
}
