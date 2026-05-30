import type { ComponentType } from 'react'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import CardContent from '@mui/material/CardContent'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import SyncProblemIcon from '@mui/icons-material/SyncProblem'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import SectionHeader from '@TAF/components/Shared/SectionHeader'
import SectionContainer from '@TAF/components/Shared/SectionContainer'

type Problem = {
  icon: ComponentType<{ sx?: object }>
  title: string
  description: string
}

const problems: Problem[] = [
  {
    icon: WarningAmberIcon,
    title: 'Secrets scattered everywhere',
    description:
      'Your team shares API keys over Slack, stores them in .env files, and hopes no one leaks them. Every developer with a key is a potential breach.',
  },
  {
    icon: SyncProblemIcon,
    title: 'Every developer, a different setup',
    description:
      'Each engineer configures their own AI tool environment. Different versions, different credentials, different bugs. Onboarding takes days instead of seconds.',
  },
  {
    icon: VisibilityOffIcon,
    title: 'No visibility, no control',
    description:
      'You cannot see what your AI tools are doing, which APIs they call, or what credentials they use. One misconfigured prompt and your keys are exposed.',
  },
]

const cardSx = {
  height: '100%',
  bgcolor: (t: any) =>
    t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)',
  border: 1,
  borderColor: 'divider',
} as const

const ProblemStatement = () => (
  <SectionContainer
    id='problem'
    sx={{
      bgcolor: (t) =>
        t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
    }}
  >
    <SectionHeader
      overline='THE PROBLEM'
      title='AI tools are powerful. Managing them is not.'
      subtitle='Your team already uses AI coding agents. But without a platform, every developer is on their own.'
    />
    <Grid
      container
      spacing={3}
      sx={{ mb: 4 }}
    >
      {problems.map((p) => {
        const Icon = p.icon
        return (
          <Grid
            item
            key={p.title}
            xs={12}
            md={4}
          >
            <Card sx={cardSx}>
              <CardContent sx={{ p: 3 }}>
                <Icon sx={{ fontSize: 32, color: 'warning.main', mb: 2 }} />
                <Typography
                  variant='h6'
                  sx={{ mb: 1, fontWeight: 600 }}
                >
                  {p.title}
                </Typography>
                <Typography
                  variant='body2'
                  color='text.secondary'
                  sx={{ lineHeight: 1.7 }}
                >
                  {p.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )
      })}
    </Grid>
    <Typography
      variant='body1'
      sx={{ textAlign: 'center', maxWidth: 640, mx: 'auto' }}
    >
      Threaded Stack solves all three. Your team gets standardized, secure AI sandboxes.
      You get full visibility and control.
    </Typography>
  </SectionContainer>
)

export default ProblemStatement
