import type { TParsedEvent } from '@tdsk/domain'

import { useCallback } from 'react'
import { approvePermission, denyPermission } from '@TTH/actions/sessions'
import { Card, CardContent, Box, Typography, Button } from '@mui/material'
import { Warning } from '@mui/icons-material'

export type TPermissionCard = {
  event: Extract<TParsedEvent, { type: 'permission' }>
  sandboxId: string
  readOnly?: boolean
}

export const PermissionCard = (props: TPermissionCard) => {
  const { event, sandboxId, readOnly } = props

  const handleApprove = useCallback(() => {
    approvePermission(sandboxId)
  }, [sandboxId])

  const handleDeny = useCallback(() => {
    denyPermission(sandboxId)
  }, [sandboxId])

  return (
    <Card
      variant='outlined'
      sx={{
        borderColor: `warning.main`,
        backgroundColor: `warning.light`,
      }}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box
          display='flex'
          alignItems='flex-start'
          gap={1}
          mb={event.command || !readOnly ? 1 : 0}
        >
          <Warning
            color='warning'
            sx={{ fontSize: 20, mt: 0.25 }}
          />
          <Typography variant='body2'>{event.prompt}</Typography>
        </Box>
        {event.command && (
          <Typography
            variant='body2'
            sx={{
              fontFamily: `'JetBrains Mono', monospace`,
              fontSize: `0.8rem`,
              backgroundColor: `action.hover`,
              px: 1.5,
              py: 0.75,
              borderRadius: 1,
              mb: readOnly ? 0 : 1,
              whiteSpace: `pre-wrap`,
            }}
          >
            {event.command}
          </Typography>
        )}
        {!readOnly && (
          <Box
            display='flex'
            gap={1}
          >
            <Button
              size='small'
              variant='contained'
              color='success'
              onClick={handleApprove}
            >
              Approve
            </Button>
            <Button
              size='small'
              variant='outlined'
              color='error'
              onClick={handleDeny}
            >
              Deny
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
