import { Box, Button, Chip, Typography } from '@mui/material'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import type { TFeedEvent } from '@TTH/ast'

type TPromptEvent = Extract<TFeedEvent, { kind: 'prompt' }>

export type TPromptCardProps = {
  event: TPromptEvent
  onRespond?: (answer: string) => void
}

const STATUS_COLORS: Record<TPromptEvent['status'], string> = {
  waiting: `#f59e0b`,
  answered: `#22c55e`,
}

export const PromptCard = (props: TPromptCardProps) => {
  const { event, onRespond } = props
  const color = STATUS_COLORS[event.status]
  const isWaiting = event.status === `waiting`

  return (
    <Box
      sx={{
        display: `flex`,
        flexDirection: `column`,
        gap: 1,
        py: 0.75,
        px: 1,
        borderRadius: 1,
        border: `1px solid`,
        borderColor: isWaiting ? `warning.main` : `divider`,
        backgroundColor: isWaiting ? `rgba(245, 158, 11, 0.05)` : `transparent`,
      }}
    >
      <Box sx={{ display: `flex`, alignItems: `flex-start`, gap: 1 }}>
        <FiberManualRecordIcon sx={{ fontSize: 10, color, flexShrink: 0, mt: 0.6 }} />
        <Typography
          variant='body2'
          sx={{ fontWeight: 500 }}
        >
          {event.question}
        </Typography>
      </Box>

      {isWaiting && event.options && event.options.length > 0 && (
        <Box sx={{ display: `flex`, flexWrap: `wrap`, gap: 0.75, pl: 2.5 }}>
          {event.options.map((opt, idx) => (
            <Button
              key={opt + idx}
              size='small'
              variant='outlined'
              onClick={() => onRespond?.(opt)}
              sx={{ textTransform: `none`, minWidth: 0 }}
            >
              {opt}
            </Button>
          ))}
        </Box>
      )}

      {event.status === `answered` && event.answer && (
        <Box sx={{ pl: 2.5 }}>
          <Chip
            label={event.answer}
            size='small'
            color='success'
            variant='outlined'
          />
        </Box>
      )}
    </Box>
  )
}
