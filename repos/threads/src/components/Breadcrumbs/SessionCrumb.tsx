import Box from '@mui/material/Box'
import { Avatar } from '@tdsk/components'
import Typography from '@mui/material/Typography'
import { useOpenSessions } from '@TTH/state/selectors'

export type TSessionCrumb = {
  sessionId: string
}

export const SessionCrumb = (props: TSessionCrumb) => {
  const { sessionId } = props

  const [openSessions] = useOpenSessions()
  const session = openSessions.get(sessionId)

  const label = session?.runtime || sessionId.slice(-8)

  return (
    <Box
      sx={{
        display: `flex`,
        alignItems: `center`,
        gap: `6px`,
      }}
    >
      <Avatar
        name={label}
        identifier={sessionId}
        size='sm'
      />
      <Typography
        noWrap
        variant='body2'
        sx={{
          maxWidth: 150,
          fontWeight: 600,
          color: `text.primary`,
        }}
      >
        {label}
      </Typography>
    </Box>
  )
}
