import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export type TNavRailSection = {
  label: string
}

export const NavRailSection = (props: TNavRailSection) => {
  const { label } = props

  return (
    <Box
      className='tdsk-rail-section'
      sx={{ px: 2, pt: 1.5, pb: 0.5 }}
    >
      <Typography
        className='tdsk-rail-section-label'
        sx={{
          fontSize: `11px`,
          fontWeight: 600,
          letterSpacing: `0.08em`,
          textTransform: `uppercase`,
          color: `text.secondary`,
        }}
      >
        {label}
      </Typography>
    </Box>
  )
}
