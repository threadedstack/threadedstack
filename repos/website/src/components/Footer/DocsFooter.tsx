import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'

const DocsFooter = () => (
  <Box
    component='footer'
    sx={{ borderTop: 1, borderColor: 'divider', py: 2, mt: 'auto' }}
  >
    <Container maxWidth='lg'>
      <Typography
        variant='caption'
        color='text.secondary'
      >
        &copy; {new Date().getFullYear()} Threaded Stack. All rights reserved.
      </Typography>
    </Container>
  </Box>
)

export default DocsFooter
