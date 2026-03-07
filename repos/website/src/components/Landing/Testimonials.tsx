import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import SectionContainer from '@TAF/components/Shared/SectionContainer'

const stats = [
  { value: '1,000+', label: 'Organizations' },
  { value: '50K+', label: 'API Calls Daily' },
  { value: '99.9%', label: 'Uptime' },
  { value: '<100ms', label: 'Avg Response' },
]

const Testimonials = () => (
  <SectionContainer
    sx={{
      bgcolor: (t) =>
        t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
    }}
  >
    <Typography
      variant='overline'
      sx={{
        textAlign: 'center',
        display: 'block',
        letterSpacing: 3,
        color: 'primary.main',
        fontWeight: 600,
        mb: 4,
      }}
    >
      TRUSTED BY DEVELOPERS
    </Typography>
    <Grid
      container
      spacing={4}
    >
      {stats.map((stat) => (
        <Grid
          item
          key={stat.label}
          xs={6}
          md={3}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant='h3'
              sx={{ fontWeight: 800, mb: 0.5, color: 'primary.main' }}
            >
              {stat.value}
            </Typography>
            <Typography
              variant='body2'
              color='text.secondary'
            >
              {stat.label}
            </Typography>
          </Box>
        </Grid>
      ))}
    </Grid>
  </SectionContainer>
)

export default Testimonials
