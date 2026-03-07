import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import ApiIcon from '@mui/icons-material/Api'
import CloudQueueIcon from '@mui/icons-material/CloudQueue'
import BusinessIcon from '@mui/icons-material/Business'
import { Link as RouterLink } from 'react-router'
import SectionContainer from '@TAF/components/Shared/SectionContainer'
import SectionHeader from '@TAF/components/Shared/SectionHeader'

const useCases = [
  {
    icon: SmartToyIcon,
    title: 'Autonomous AI Agents',
    description:
      'Build agents that reason, plan, and execute multi-step tasks using tools and external APIs. Full conversation memory, branching threads, and streaming responses out of the box.',
  },
  {
    icon: ApiIcon,
    title: 'Secure API Orchestration',
    description:
      'Proxy and orchestrate calls to external APIs with automatic authentication injection. Secrets never leave the server — your agents interact with APIs without ever seeing credentials.',
  },
  {
    icon: CloudQueueIcon,
    title: 'Serverless Functions',
    description:
      'Deploy custom functions that run in isolated sandboxes. From lightweight V8 isolates for quick transformations to full Firecracker microVMs for complex compute workloads.',
  },
  {
    icon: BusinessIcon,
    title: 'Multi-Tenant SaaS Platform',
    description:
      'Build SaaS products on top of Threaded Stack with built-in multi-tenancy. Organizations, projects, roles, quotas, and billing are all handled for you.',
  },
]

const UseCases = () => (
  <SectionContainer id='use-cases'>
    <SectionHeader
      overline='USE CASES'
      title='Built for Real-World Applications'
      subtitle='See how teams are using Threaded Stack to ship production AI systems.'
    />
    <Grid
      container
      spacing={3}
    >
      {useCases.map((uc) => (
        <Grid
          item
          key={uc.title}
          xs={12}
          sm={6}
        >
          <Card
            sx={{
              height: '100%',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-4px)' },
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Box
                sx={{
                  mb: 2,
                  width: 56,
                  height: 56,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: (t) =>
                    t.palette.mode === 'dark'
                      ? 'rgba(51,112,222,0.12)'
                      : 'rgba(51,112,222,0.08)',
                }}
              >
                <uc.icon sx={{ fontSize: 32, color: 'primary.main' }} />
              </Box>
              <Typography
                variant='h5'
                sx={{ mb: 1.5 }}
              >
                {uc.title}
              </Typography>
              <Typography
                variant='body2'
                color='text.secondary'
                sx={{ mb: 2, lineHeight: 1.7 }}
              >
                {uc.description}
              </Typography>
              <Button
                component={RouterLink}
                to='/use-cases'
                size='small'
                sx={{ px: 0, '&:hover': { bgcolor: 'transparent' } }}
              >
                Learn more →
              </Button>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  </SectionContainer>
)

export default UseCases
