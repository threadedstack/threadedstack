import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import Button from '@mui/material/Button'
import { Link as RouterLink } from 'react-router'
import Typography from '@mui/material/Typography'
import CardContent from '@mui/material/CardContent'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import SchoolIcon from '@mui/icons-material/School'
import CompareIcon from '@mui/icons-material/Compare'
import GppGoodIcon from '@mui/icons-material/GppGood'
import BusinessIcon from '@mui/icons-material/Business'
import IconBadge from '@TAF/components/Shared/IconBadge'
import CloudQueueIcon from '@mui/icons-material/CloudQueue'
import ScreenShareIcon from '@mui/icons-material/ScreenShare'
import SectionHeader from '@TAF/components/Shared/SectionHeader'
import SectionContainer from '@TAF/components/Shared/SectionContainer'

const useCases = [
  {
    icon: BusinessIcon,
    title: `Platform Engineering`,
    description: `Give every developer on your team a standardized AI tool environment. Configure sandbox presets and provider credentials once at the org level — they propagate to all projects automatically.`,
  },
  {
    icon: VpnKeyIcon,
    title: `Secure Credential Management`,
    description: `Centralize LLM API keys with zero-trust injection. The MITM egress proxy resolves credentials at the network layer — AI tools cannot exfiltrate real secrets from the sandbox.`,
  },
  {
    icon: CloudQueueIcon,
    title: `Remote AI Development`,
    description: `Run Claude Code, Codex, or any AI tool in a cloud sandbox with full file sync. Develop on your laptop, execute in a reproducible environment with consistent dependencies and resources.`,
  },
  {
    icon: ScreenShareIcon,
    title: `Collaborative AI Sessions`,
    description: `Share live AI tool sessions with teammates in real-time. Pair-program with AI from the CLI or browser — public sessions let your whole team observe and learn from AI-assisted workflows.`,
  },
  {
    icon: SchoolIcon,
    title: 'AI Onboarding',
    description:
      'New engineers launch a sandbox and start coding with AI on day one. No environment setup, no credential sharing, no configuration guides.',
  },
  {
    icon: GppGoodIcon,
    title: 'Security & Compliance',
    description:
      'Audit every outbound API call from every sandbox. Domain allowlists ensure credentials only reach approved endpoints. Full egress proxy logging.',
  },
  {
    icon: CompareIcon,
    title: 'Multi-Tool Evaluation',
    description:
      'Run Claude Code, Codex, and OpenCode in parallel sandboxes with identical configurations. Compare tools objectively without reconfiguring anything.',
  },
]

const UseCases = () => (
  <SectionContainer id='use-cases'>
    <SectionHeader
      overline='USE CASES'
      title='Built for How Teams Actually Use AI Tools'
      subtitle='See how engineering teams standardize and secure their AI coding tool environments.'
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
              <Box sx={{ mb: 2 }}>
                <IconBadge
                  icon={uc.icon}
                  size={56}
                  iconSize={32}
                />
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
