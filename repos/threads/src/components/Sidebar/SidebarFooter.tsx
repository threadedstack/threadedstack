import { Avatar } from '@tdsk/components'
import { useUser } from '@TTH/state/selectors'
import { Box, Typography } from '@mui/material'

export const SidebarFooter = () => {
  const [user] = useUser()

  if (!user) return null

  const displayName = user.displayName || user.email || ``

  return (
    <Box
      sx={{
        px: 1,
        py: 1,
        gap: 1,
        borderTop: 1,
        display: `flex`,
        alignItems: `center`,
        borderColor: `divider`,
      }}
    >
      <Avatar
        name={displayName}
        size='md'
      />
      <Box
        className='tdsk-rail-item-text'
        sx={{ minWidth: 0, flex: 1 }}
      >
        <Typography
          noWrap
          sx={{
            fontSize: `13px`,
            fontWeight: 500,
            lineHeight: 1.3,
            color: `text.primary`,
          }}
        >
          {user.displayName || user.email}
        </Typography>
        {user.displayName && user.email && (
          <Typography
            noWrap
            sx={{
              fontSize: `11px`,
              lineHeight: 1.3,
              color: `text.secondary`,
            }}
          >
            {user.email}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
