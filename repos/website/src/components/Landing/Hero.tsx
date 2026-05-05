import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import { useTheme } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import ArchitectureDiagram from './ArchitectureDiagram'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { TDSK_AD_APP_URL } from '@TAF/constants/envs'

const Hero = () => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: isDark ? '#1A1D21' : '#FAFBFC',
      }}
    >
      {/* Background radial glow */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          backgroundImage: isDark
            ? 'radial-gradient(ellipse at 30% 50%, rgba(51,112,222,0.08) 0%, transparent 60%)'
            : 'radial-gradient(ellipse at 25% 40%, rgba(51,112,222,0.07) 0%, transparent 55%), radial-gradient(ellipse at 80% 65%, rgba(51,112,222,0.06) 0%, transparent 50%)',
        }}
      />

      {/* Floating blob 1 */}
      <Box
        sx={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle, rgba(51,112,222,0.06) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(51,112,222,0.08) 0%, transparent 65%)',
          top: '10%',
          left: '5%',
          zIndex: 0,
          animation: 'heroFloat1 18s ease-in-out infinite',
          '@keyframes heroFloat1': {
            '0%': { transform: 'translate(0, 0)' },
            '15%': { transform: 'translate(120px, 40px)' },
            '35%': { transform: 'translate(250px, -30px)' },
            '55%': { transform: 'translate(180px, 120px)' },
            '75%': { transform: 'translate(50px, 80px)' },
            '100%': { transform: 'translate(0, 0)' },
          },
        }}
      />

      {/* Floating blob 2 */}
      <Box
        sx={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle, rgba(51,112,222,0.04) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(51,112,222,0.06) 0%, transparent 65%)',
          bottom: '15%',
          right: '10%',
          zIndex: 0,
          animation: 'heroFloat2 22s ease-in-out infinite',
          '@keyframes heroFloat2': {
            '0%': { transform: 'translate(0, 0)' },
            '20%': { transform: 'translate(-100px, -60px)' },
            '40%': { transform: 'translate(-200px, 30px)' },
            '60%': { transform: 'translate(-120px, -100px)' },
            '80%': { transform: 'translate(-50px, -40px)' },
            '100%': { transform: 'translate(0, 0)' },
          },
        }}
      />

      <Container
        maxWidth='lg'
        sx={{ position: 'relative', zIndex: 1 }}
      >
        <Grid
          container
          spacing={6}
          alignItems='center'
        >
          <Grid
            item
            xs={12}
            md={6}
          >
            {/* Overline */}
            <Typography
              variant='overline'
              sx={{
                color: 'primary.main',
                letterSpacing: 3,
                fontWeight: 600,
                mb: 2,
                display: 'block',
                fontSize: '0.75rem',
              }}
            >
              PERMISSIONED, ISOLATED, SECURE AI SANDBOXES
            </Typography>

            {/* Headline with gradient text */}
            <Typography
              variant='h1'
              sx={{
                mb: 3,
                fontWeight: 800,
                fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
                lineHeight: 1.15,
              }}
            >
              <span className={isDark ? 'gradient-text-dark' : 'gradient-text-light'}>
                Unleash AI Agents with Confidence
              </span>
            </Typography>

            {/* Subheadline */}
            <Typography
              variant='body1'
              color='text.secondary'
              sx={{ mb: 4, fontSize: '1.1rem', lineHeight: 1.7, maxWidth: 520 }}
            >
              Launch AI agents and tools in managed K8s pods with zero-trust credential
              injection. Full support for Claude Code, Codex, OpenCode, Gemini CLI, or
              custom tooling.
            </Typography>

            {/* CTAs */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              <Button
                variant='contained'
                size='large'
                endIcon={<ArrowForwardIcon />}
                href={TDSK_AD_APP_URL}
              >
                Get Started Free
              </Button>
              <Button
                variant='outlined'
                size='large'
                href='mailto:demo@threadedstack.com'
              >
                Request a Demo
              </Button>
            </Box>

            {/* Helper text */}
            <Typography
              variant='caption'
              color='text.secondary'
            >
              Free tier available. No credit card required.
            </Typography>
          </Grid>

          <Grid
            item
            xs={12}
            md={6}
          >
            <ArchitectureDiagram />
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}

export default Hero
