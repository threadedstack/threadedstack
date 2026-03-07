import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ConstructionIcon from '@mui/icons-material/Construction'

const ComingSoon = () => (
  <Box sx={{ textAlign: 'center', py: 8 }}>
    <ConstructionIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
    <Typography
      variant='h5'
      sx={{ mb: 1 }}
    >
      Coming Soon
    </Typography>
    <Typography
      variant='body2'
      color='text.secondary'
    >
      This documentation page is under construction. Check back soon or visit our GitHub
      for updates.
    </Typography>
  </Box>
)

export default ComingSoon
