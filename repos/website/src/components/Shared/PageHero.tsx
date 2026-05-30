import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'

type Props = {
  overline: string
  title: string
  subtitle: string
}

const PageHero = ({ overline, title, subtitle }: Props) => (
  <Box
    sx={{
      py: { xs: 8, md: 12 },
      bgcolor: (t) => (t.palette.mode === 'dark' ? '#1A1D21' : '#FAFBFC'),
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        backgroundImage: (t) =>
          t.palette.mode === 'dark'
            ? 'radial-gradient(ellipse at 50% 50%, rgba(51,112,222,0.06) 0%, transparent 60%)'
            : 'radial-gradient(ellipse at 50% 50%, rgba(51,112,222,0.03) 0%, transparent 60%)',
      }}
    />
    <Container
      maxWidth='lg'
      sx={{ position: 'relative', textAlign: 'center' }}
    >
      <Typography
        variant='overline'
        sx={{
          color: 'primary.main',
          letterSpacing: 3,
          fontWeight: 600,
          mb: 2,
          display: 'block',
        }}
      >
        {overline}
      </Typography>
      <Typography
        variant='h2'
        sx={{ mb: 2, fontWeight: 700 }}
      >
        {title}
      </Typography>
      <Typography
        variant='body1'
        color='text.secondary'
        sx={{ maxWidth: 560, mx: 'auto' }}
      >
        {subtitle}
      </Typography>
    </Container>
  </Box>
)

export default PageHero
