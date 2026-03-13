import type { TChatToolCall } from '@TSC/types'

import { useState } from 'react'
import { Box, Chip, Collapse, Typography, IconButton } from '@mui/material'
import {
  Build as BuildIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material'

export type TToolCallDisplay = {
  toolCall: TChatToolCall
}

const styles = {
  pre: {
    m: 0,
    p: 1,
    maxHeight: 200,
    overflow: `auto`,
    borderRadius: 0.5,
    fontSize: `0.75rem`,
    fontFamily: `monospace`,
    whiteSpace: `pre-wrap`,
    wordBreak: `break-word`,
  } as const,
}

export const ToolCallDisplay = (props: TToolCallDisplay) => {
  const { toolCall } = props
  const [expanded, setExpanded] = useState(false)

  const hasResult = toolCall.result !== undefined

  return (
    <Box
      sx={{
        my: 1,
        border: 1,
        borderColor: `divider`,
        borderRadius: 1,
        overflow: `hidden`,
      }}
    >
      <Box
        sx={{
          display: `flex`,
          alignItems: `center`,
          gap: 1,
          px: 1.5,
          py: 0.75,
          bgcolor: `action.hover`,
          cursor: `pointer`,
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <BuildIcon sx={{ fontSize: 16, color: `text.secondary` }} />
        <Chip
          size='small'
          label={toolCall.name}
          variant='outlined'
        />
        {hasResult && !toolCall.isError && (
          <CheckCircleIcon sx={{ fontSize: 16, color: `success.main` }} />
        )}
        {toolCall.isError && <ErrorIcon sx={{ fontSize: 16, color: `error.main` }} />}
        {!hasResult && (
          <Typography
            variant='caption'
            color='text.secondary'
            sx={{ fontStyle: `italic` }}
          >
            running...
          </Typography>
        )}
        <IconButton
          size='small'
          sx={{
            ml: `auto`,
            transform: expanded ? `rotate(180deg)` : `none`,
            transition: `transform 0.2s`,
          }}
        >
          <ExpandMoreIcon fontSize='small' />
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 1.5, py: 1 }}>
          {toolCall.args && (
            <Box sx={{ mb: 1 }}>
              <Typography
                variant='caption'
                color='text.secondary'
                display='block'
                sx={{ mb: 0.5 }}
              >
                Arguments
              </Typography>
              <Box
                component='pre'
                sx={{ ...styles.pre, bgcolor: `background.default` }}
              >
                {formatArgs(toolCall.args)}
              </Box>
            </Box>
          )}

          {hasResult && (
            <Box>
              <Typography
                variant='caption'
                color={toolCall.isError ? `error.main` : `text.secondary`}
                display='block'
                sx={{ mb: 0.5 }}
              >
                {toolCall.isError ? `Error` : `Result`}
              </Typography>
              <Box
                component='pre'
                sx={{
                  ...styles.pre,
                  bgcolor: toolCall.isError ? `error.50` : `background.default`,
                }}
              >
                {toolCall.result}
              </Box>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  )
}

const formatArgs = (args: string): string => {
  try {
    return JSON.stringify(JSON.parse(args), null, 2)
  } catch {
    return args
  }
}
