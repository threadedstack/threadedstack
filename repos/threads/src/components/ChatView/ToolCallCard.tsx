import type { TParsedEvent } from '@tdsk/domain'

import { useState, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Collapse,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material'
import { Check, ExpandMore, ExpandLess } from '@mui/icons-material'

export type TToolCallCard = {
  event: Extract<TParsedEvent, { type: 'tool-call' }>
}

export const ToolCallCard = (props: TToolCallCard) => {
  const { event } = props
  const [open, setOpen] = useState(false)

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  const isRunning = event.status === `running`

  return (
    <Card
      variant='outlined'
      sx={{ backgroundColor: `background.default` }}
    >
      <CardActionArea onClick={handleToggle}>
        <Box
          display='flex'
          alignItems='center'
          gap={1}
          px={2}
          py={1}
        >
          <Typography
            variant='body2'
            fontWeight={600}
            sx={{ flexShrink: 0 }}
          >
            {event.tool}
          </Typography>
          <Typography
            variant='body2'
            color='text.secondary'
            noWrap
            sx={{
              flex: 1,
              minWidth: 0,
              fontFamily: `'JetBrains Mono', monospace`,
              fontSize: `0.8rem`,
            }}
          >
            {event.target}
          </Typography>
          <Chip
            size='small'
            label={event.status}
            icon={
              isRunning ? (
                <CircularProgress
                  size={12}
                  thickness={5}
                />
              ) : (
                <Check sx={{ fontSize: 14 }} />
              )
            }
            color={isRunning ? `info` : `success`}
            variant='outlined'
            sx={{ flexShrink: 0 }}
          />
          {event.detail &&
            (open ? <ExpandLess fontSize='small' /> : <ExpandMore fontSize='small' />)}
        </Box>
      </CardActionArea>
      {event.detail && (
        <Collapse in={open}>
          <CardContent sx={{ pt: 0, pb: 1 }}>
            <Typography
              variant='body2'
              sx={{
                fontFamily: `'JetBrains Mono', monospace`,
                fontSize: `0.8rem`,
                whiteSpace: `pre-wrap`,
                color: `text.secondary`,
              }}
            >
              {event.detail}
            </Typography>
          </CardContent>
        </Collapse>
      )}
    </Card>
  )
}
