import type { TParsedEvent } from '@tdsk/domain'

import { useState, useCallback } from 'react'
import { Card, CardActionArea, Collapse, Box, Typography } from '@mui/material'
import { DifferenceOutlined, ExpandMore, ExpandLess } from '@mui/icons-material'

export type TDiffCard = {
  event: Extract<TParsedEvent, { type: 'diff' }>
}

export const DiffCard = (props: TDiffCard) => {
  const { event } = props
  const [open, setOpen] = useState(false)

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

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
          <DifferenceOutlined
            fontSize='small'
            color='action'
          />
          <Typography
            variant='body2'
            fontWeight={600}
            sx={{
              flex: 1,
              minWidth: 0,
              fontFamily: `'JetBrains Mono', monospace`,
              fontSize: `0.8rem`,
            }}
            noWrap
          >
            {event.file}
          </Typography>
          <Typography
            variant='caption'
            color='success.main'
          >
            +{event.additions.length}
          </Typography>
          <Typography
            variant='caption'
            color='error.main'
          >
            -{event.removals.length}
          </Typography>
          {open ? <ExpandLess fontSize='small' /> : <ExpandMore fontSize='small' />}
        </Box>
      </CardActionArea>
      <Collapse in={open}>
        <Box
          sx={{
            px: 2,
            pb: 1.5,
            fontFamily: `'JetBrains Mono', monospace`,
            fontSize: `0.8rem`,
            whiteSpace: `pre`,
            overflow: `auto`,
          }}
        >
          {event.additions.map((line, idx) => (
            <Box
              key={`a-${idx}`}
              sx={{
                backgroundColor: `success.light`,
                color: `success.dark`,
                px: 1,
                borderRadius: 0.5,
              }}
            >
              +{line}
            </Box>
          ))}
          {event.removals.map((line, idx) => (
            <Box
              key={`r-${idx}`}
              sx={{
                backgroundColor: `error.light`,
                color: `error.dark`,
                px: 1,
                borderRadius: 0.5,
              }}
            >
              -{line}
            </Box>
          ))}
        </Box>
      </Collapse>
    </Card>
  )
}
