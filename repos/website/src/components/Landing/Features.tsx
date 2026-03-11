import Grid from '@mui/material/Grid'
import { RobotIcon } from '@tdsk/components'
import CloudIcon from '@mui/icons-material/Cloud'
import ForumIcon from '@mui/icons-material/Forum'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import BusinessIcon from '@mui/icons-material/Business'
import SecurityIcon from '@mui/icons-material/Security'
import FeatureCard from '@TAF/components/Shared/FeatureCard'
import SectionHeader from '@TAF/components/Shared/SectionHeader'
import SectionContainer from '@TAF/components/Shared/SectionContainer'

const features = [
  {
    icon: SecurityIcon,
    title: 'Auth Proxy',
    description:
      'Enterprise-grade JWT/JWKS authentication gateway that validates every request before it reaches your backend. Supports social login, API keys, and session tokens.',
  },
  {
    icon: RobotIcon,
    title: 'AI Agent Runtime',
    description:
      'Run autonomous AI agents with built-in tool execution, provider routing, and streaming support. Connect any LLM provider through a unified interface.',
  },
  {
    icon: CloudIcon,
    title: 'Serverless Compute',
    description:
      'Deploy functions that execute in isolated sandboxes — from lightweight V8 isolates to full Firecracker microVMs. Zero cold start, automatic scaling.',
  },
  {
    icon: VpnKeyIcon,
    title: 'Secrets Management',
    description:
      'AES-256-GCM encrypted secrets injected server-side at runtime. Your AI agents never see raw API keys — they are resolved transparently.',
  },
  {
    icon: ForumIcon,
    title: 'Threads & Memory',
    description:
      'Persistent conversation threads with message history, branching, and metadata. Built-in context management for long-running AI interactions.',
  },
  {
    icon: BusinessIcon,
    title: 'Multi-Tenant Design',
    description:
      'Organization and project hierarchy with role-based access control. Isolate resources, manage members, and track usage across teams.',
  },
]

const Features = () => (
  <SectionContainer id='features'>
    <SectionHeader
      overline='PLATFORM CAPABILITIES'
      title='Everything You Need to Build AI Agents'
      subtitle='A complete platform that replaces stitching together Vercel, Lambda, LangChain, and Vault.'
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
