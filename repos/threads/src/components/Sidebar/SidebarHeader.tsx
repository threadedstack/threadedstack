import { nav } from '@TTH/services/nav'
import { TSIcon, colors } from '@tdsk/components'
import { Box, Typography, IconButton } from '@mui/material'

const iconStyle = {
  width: `28px`,
  height: `28px`,
  fill: colors.primary.main,
}

export const SidebarHeader = () => {
  return (
    <Box
      sx={{
        px: 0.5,
        py: 0.5,
        display: `flex`,
        borderBottom: 1,
        alignItems: `center`,
        borderColor: `divider`,
      }}
    >
      <IconButton
        onClick={() => nav.home()}
        sx={{
          padding: `2px`,
          display: `flex`,
          margin: `0 6px`,
          borderRadius: `6px`,
          alignItems: `center`,
        }}
      >
        <TSIcon svgStyle={iconStyle} />
      </IconButton>
      <Typography
        noWrap
        variant='h6'
        className='tdsk-rail-item-text'
        sx={{
          fontSize: `16px`,
          color: `text.primary`,
          letterSpacing: `-0.5px`,
        }}
      >
        Threaded Stack
      </Typography>
    </Box>
  )
}
