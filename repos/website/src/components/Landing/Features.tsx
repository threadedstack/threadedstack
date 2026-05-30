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
      'Pre-configured K8s pods for Claude Code, Codex, OpenCode, Antigravity, OpenClaw, or your own custom runtime. SSH-enabled with configurable resources, idle timeouts, and automatic file sync.',
  },
  {
    icon: SecurityIcon,
    title: 'Zero-Trust Egress Proxy',
    description:
      'All outbound traffic from sandbox pods passes through an encrypted MITM proxy. Placeholder tokens are resolved to real secrets server-side — AI tools never see actual credentials.',
  },
  {
    icon: VpnKeyIcon,
    title: 'Secret Management',
    description:
      'AES-256-GCM encrypted secrets with fine-grained scoping. Injected at runtime via environment variables, files, or MITM replacement. Never exposed to client code or AI tools.',
  },
  {
    icon: SyncIcon,
    title: 'Bidirectional File Sync',
    description:
      'Sync files between your local machine and the sandbox pod in real-time. Edit locally, execute remotely — or let the AI tool generate code and pull it back instantly.',
  },
  {
    icon: BusinessIcon,
    title: 'Team Management',
    description:
      'Multi-tenant organization and project hierarchy with role-based access control. Centralize sandbox configurations, secrets, and provider credentials across your engineering team.',
  },
  {
    icon: ScreenShareIcon,
    title: 'Session Sharing',
    description:
      'Share live terminal sessions across CLI and browser in real-time. Multiple users collaborate on the same sandbox with public/private visibility and buffered output replay.',
  },
]

const Features = () => (
  <SectionContainer id='features'>
    <SectionHeader
      overline='PLATFORM CAPABILITIES'
      title='Secure AI Tool execution'
      subtitle='A managed platform that handles environments, credentials, and collaboration, letting you and your team move faster.'
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
