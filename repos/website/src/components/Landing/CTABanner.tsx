import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router'
import { TDSK_AD_APP_URL } from '@TAF/constants/envs'

const CTABanner = () => (
  <Box
    className='gradient-bg-cta'
    sx={{ py: { xs: 8, md: 10 } }}
  >
    <Container
      maxWidth='md'
      sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}
    >
      <Typography
        variant='h4'
        sx={{ color: '#fff', fontWeight: 700, mb: 2 }}
      >
        Ready to Run?
      </Typography>
      <Typography
        variant='body1'
        sx={{ color: 'rgba(255,255,255,0.8)', mb: 4, maxWidth: 480, mx: 'auto' }}
      >
        Launch a sandboxed AI coding session in under 60 seconds. Free forever on the
        starter tier.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button
          size='large'
          variant='contained'
          href={TDSK_AD_APP_URL}
          sx={{
            bgcolor: '#fff',
            color: 'primary.main',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
          }}
        >
          Get Started Free
        </Button>
        <Button
          to='/docs'
          size='large'
          variant='outlined'
          component={RouterLink}
          sx={{
            color: '#fff',
            borderColor: 'rgba(255,255,255,0.5)',
            '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' },
          }}
        >
          Read the Docs
        </Button>
      </Box>
    </Container>
  </Box>
)

export default CTABanner
