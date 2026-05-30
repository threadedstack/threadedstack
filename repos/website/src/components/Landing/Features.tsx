import Grid from '@mui/material/Grid'
import SyncIcon from '@mui/icons-material/Sync'
import CloudIcon from '@mui/icons-material/Cloud'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import BusinessIcon from '@mui/icons-material/Business'
import SecurityIcon from '@mui/icons-material/Security'
import ScreenShareIcon from '@mui/icons-material/ScreenShare'
import FeatureCard from '@TAF/components/Shared/FeatureCard'
import SectionHeader from '@TAF/components/Shared/SectionHeader'
import SectionContainer from '@TAF/components/Shared/SectionContainer'

const features = [
  {
    icon: CloudIcon,
    title: 'Managed Sandboxes',
    description:
      'One command to launch a sandboxed Claude Code, Codex, or OpenCode session. Pre-configured pods with SSH, file sync, and automatic shutdown.',
  },
  {
    icon: SecurityIcon,
    title: 'Zero-Trust Egress Proxy',
    description:
      'AI tools never see your real API keys. Outbound requests pass through a MITM proxy that swaps placeholder tokens for real credentials server-side.',
  },
  {
    icon: VpnKeyIcon,
    title: 'Secret Management',
    description:
      'Encrypted at rest, injected at runtime, redacted everywhere else. Secrets are scoped per-org, per-project, or per-provider.',
  },
  {
    icon: SyncIcon,
    title: 'Bidirectional File Sync',
    description:
      'Edit locally, run remotely. Real-time Mutagen sync keeps your laptop and sandbox in lockstep. AI-generated changes appear on your filesystem instantly.',
  },
  {
    icon: BusinessIcon,
    title: 'Team Management',
    description:
      'One org, shared sandboxes, role-based access. Configure credentials once; every developer gets the right setup automatically.',
  },
  {
    icon: ScreenShareIcon,
    title: 'Session Sharing',
    description:
      'Watch an AI tool work in real-time, from the CLI or browser. Share sessions with teammates, reconnect without losing context.',
  },
]

const Features = () => (
  <SectionContainer id='features'>
    <SectionHeader
      overline='WHAT YOU GET'
      title='Everything your team needs to run AI tools safely'
      subtitle='Managed sandboxes, zero-trust credentials, real-time file sync, and team collaboration. All from a single platform.'
    />
    <Grid
      container
      spacing={3}
    >
      {features.map((f) => (
        <Grid
          item
          key={f.title}
          xs={12}
          sm={6}
          md={4}
        >
          <FeatureCard
            icon={f.icon}
            title={f.title}
            description={f.description}
          />
        </Grid>
      ))}
    </Grid>
  </SectionContainer>
)

export default Features
