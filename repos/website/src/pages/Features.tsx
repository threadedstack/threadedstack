import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Link from '@mui/material/Link'
import SecurityIcon from '@mui/icons-material/Security'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import CloudIcon from '@mui/icons-material/Cloud'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import ForumIcon from '@mui/icons-material/Forum'
import BusinessIcon from '@mui/icons-material/Business'
import type { SvgIconComponent } from '@mui/icons-material'
import CodeBlock from '@TAF/components/Shared/CodeBlock'
import PageMeta from '@TAF/components/Shared/PageMeta'

type FeatureSection = {
  icon: SvgIconComponent
  title: string
  paragraphs: string[]
  code: string
  codeLang?: string
  docsLink: string
}

const featureSections: FeatureSection[] = [
  {
    icon: SecurityIcon,
    title: 'Auth Proxy',
    paragraphs: [
      "The Threaded Stack Auth Proxy is an enterprise-grade gateway that sits in front of your backend, validating every incoming request before it reaches your application logic. Built on Express 5 and the jose JWKS library, it verifies JSON Web Tokens against your identity provider's published key sets with zero configuration.",
      'Beyond JWT validation, the proxy supports API key authentication (tdsk_* Bearer tokens), session-based tokens for WebSocket connections, automatic CORS handling, and rate limiting. Routes are categorized as public, protected, or admin, with each category enforcing its own authentication requirements.',
      'Because authentication is handled at the proxy layer, your backend services never need to implement auth logic. This separation of concerns means you can swap identity providers, add new auth methods, or tighten security policies without touching a single line of application code.',
    ],
    code: `# Authenticated request through the proxy
curl -s https://api.threadedstack.app/_/orgs \\
  -H "Authorization: Bearer <jwt-token>"

# API key authentication
curl -s https://api.threadedstack.app/_/agents \\
  -H "Authorization: Bearer tdsk_live_abc123"

# Health check (public, no auth required)
curl -s https://api.threadedstack.app/health`,
    codeLang: 'bash',
    docsLink: '/docs/auth-proxy',
  },
  {
    icon: SmartToyIcon,
    title: 'AI Agent Runtime',
    paragraphs: [
      'The AI Agent Runtime provides a complete execution environment for autonomous agents. Define an agent with its provider, model, system prompt, and available tools, then let Threaded Stack handle orchestration. The runtime supports multi-turn conversations, tool execution loops, and streaming Server-Sent Events for real-time responses.',
      'Provider routing lets you switch between OpenAI, Anthropic, Google, and other LLM providers through a unified interface. Each agent can be configured with its own provider and model, and the runtime handles the protocol translation transparently. Tools are defined as functions that agents can invoke during execution, with full argument validation and error handling.',
      'Streaming is first-class. Agent responses flow back to clients via SSE, with structured events for text chunks, tool calls, tool results, and completion signals. This enables responsive UIs that show agents "thinking" and acting in real time.',
    ],
    code: `// Create an agent
const agent = await fetch('/_/agents', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer tdsk_...' },
  body: JSON.stringify({
    name: 'Support Agent',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: 'You are a helpful assistant.',
    tools: ['search_docs', 'create_ticket'],
  }),
})

// Run the agent (SSE stream)
const stream = await fetch(
  '/_/agents/<id>/run',
  { method: 'POST', body: JSON.stringify({ message: 'Help me reset my password' }) }
)`,
    docsLink: '/docs/agents',
  },
  {
    icon: CloudIcon,
    title: 'Serverless Compute',
    paragraphs: [
      "Threaded Stack's serverless compute layer lets you deploy custom functions that execute in fully isolated sandboxes. Choose between lightweight V8 isolates for sub-millisecond cold starts on simple transformations, or Firecracker microVMs for workloads that need filesystem access, subprocess execution, and full OS-level isolation.",
      'Functions are deployed as endpoints with a simple API. Each function receives a context object with the request payload, environment variables, and injected secrets. The sandbox provides shims for common Node.js APIs including fs, path, and child_process, so existing code often works without modification.',
      'The compute layer handles scaling, timeout enforcement, and resource limits automatically. Functions can be triggered via HTTP, invoked by AI agents as tools, or chained together in pipelines. Execution logs and metrics are captured for every invocation.',
    ],
    code: `// Deploy a serverless function
await fetch('/_/endpoints', {
  method: 'POST',
  body: JSON.stringify({
    name: 'transform-webhook',
    type: 'faas',
    runtime: 'isolate', // or 'firecracker'
    code: \`
      export default async (ctx) => {
        const data = ctx.request.body
        const transformed = processPayload(data)
        return { status: 200, body: transformed }
      }
    \`,
  }),
})`,
    docsLink: '/docs/compute',
  },
  {
    icon: VpnKeyIcon,
    title: 'Secrets Management',
    paragraphs: [
      'Secrets in Threaded Stack are encrypted at rest using AES-256-GCM with keys derived via HKDF from a master key. When a secret is created, it is encrypted immediately and the plaintext is never stored. At runtime, secrets are decrypted server-side and injected into the execution context — your AI agents and functions never see raw API keys or credentials.',
      'Secrets are scoped using an exclusive arc pattern: each secret belongs to exactly one of an organization, project, agent, or provider. This fine-grained scoping ensures that a secret shared with one project cannot leak to another, and provider credentials are isolated to the provider that needs them.',
      'The API supports full CRUD operations on secrets with automatic re-encryption on update. Secret values are redacted in all API responses and logs. Combined with the auth proxy, this creates a zero-trust architecture where credentials flow from secure storage directly to the point of use without ever being exposed to client code.',
    ],
    code: `// Create an org-scoped secret
await fetch('/_/secrets', {
  method: 'POST',
  body: JSON.stringify({
    name: 'STRIPE_API_KEY',
    value: 'sk_live_...',        // encrypted at rest
    scope: 'organization',
    organizationId: 'org_abc123',
  }),
})

// Secrets are injected at runtime — never exposed
// In your function or agent, access via:
// ctx.secrets.STRIPE_API_KEY → decrypted value`,
    docsLink: '/docs/secrets',
  },
  {
    icon: ForumIcon,
    title: 'Threads & Memory',
    paragraphs: [
      'Threads provide persistent conversation state for AI agents. Each thread maintains an ordered message history with role attribution (user, assistant, system, tool), timestamps, and arbitrary metadata. Messages support pagination for efficient retrieval of long conversations, and threads can be listed, filtered, and searched across agents and projects.',
      'Thread branching lets you fork a conversation at any point, creating a new thread that inherits the message history up to the branch point. This is powerful for A/B testing agent responses, exploring alternative conversation paths, or letting users "undo" and retry from an earlier point in a conversation.',
      'The memory system integrates directly with the AI Agent Runtime. When an agent runs, its thread history is automatically loaded as context. Combined with configurable retention policies and message limits per subscription tier, you get built-in context management without writing a single line of memory management code.',
    ],
    code: `// Create a thread
const thread = await fetch('/_/threads', {
  method: 'POST',
  body: JSON.stringify({
    agentId: 'agent_abc123',
    metadata: { customer: 'acme-corp' },
  }),
})

// Branch from message #5
const branch = await fetch(
  '/_/threads/<id>/branch',
  {
    method: 'POST',
    body: JSON.stringify({ messageIndex: 5 }),
  },
)

// List messages with pagination
const msgs = await fetch(
  '/_/threads/<id>/messages?limit=50&offset=0'
)`,
    docsLink: '/docs/threads',
  },
  {
    icon: BusinessIcon,
    title: 'Multi-Tenant Design',
    paragraphs: [
      'Threaded Stack is built from the ground up for multi-tenancy. Organizations are the top-level isolation boundary, containing projects, members, roles, secrets, and billing. Each organization has its own API keys, quota limits, and subscription tier, ensuring complete resource isolation between tenants.',
      'Within an organization, projects provide a second level of grouping. Agents, endpoints, threads, and secrets can be scoped to a project, enabling teams to organize work by product, environment, or team. Role-based access control (RBAC) governs who can read, write, or administer resources at both the org and project level.',
      'Quota tracking covers 12 resource types including projects, members, endpoints, threads, messages, function calls, runtime hours, and secrets. Each subscription tier (Free, Basic, Developer, Pro) defines its own limits. Usage is tracked in real time and enforced at the API layer, so you never need to build your own metering or billing logic.',
    ],
    code: `// Create an organization
const org = await fetch('/_/orgs', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Acme Corp',
    tier: 'developer',
  }),
})

// Invite a team member
await fetch('/_/invitations', {
  method: 'POST',
  body: JSON.stringify({
    organizationId: 'org_abc123',
    email: 'dev@acme.com',
    role: 'member',
  }),
})

// Check quota usage
const quotas = await fetch('/_/quotas?orgId=org_abc123')`,
    docsLink: '/docs/multi-tenancy',
  },
]

const Features = () => (
  <>
    <PageMeta
      title='Features'
      description="Explore Threaded Stack's platform capabilities: auth proxy, AI agent runtime, serverless compute, secrets management, threads, and multi-tenant design."
    />
    <Box>
      {/* Mini Hero */}
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
            PLATFORM CAPABILITIES
          </Typography>
          <Typography
            variant='h2'
            sx={{ mb: 2, fontWeight: 700 }}
          >
            Everything Under the Hood
          </Typography>
          <Typography
            variant='body1'
            color='text.secondary'
            sx={{ maxWidth: 560, mx: 'auto' }}
          >
            A deep dive into the six core systems that power Threaded Stack — from
            authentication to multi-tenant billing.
          </Typography>
        </Container>
      </Box>

      {/* Feature Sections */}
      {featureSections.map((section, idx) => {
        const Icon = section.icon
        const reverse = idx % 2 === 1

        return (
          <Box
            key={section.title}
            component='section'
            sx={{
              py: { xs: 6, md: 10 },
              bgcolor:
                idx % 2 === 0
                  ? 'transparent'
                  : (t) =>
                      t.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.02)'
                        : 'rgba(0,0,0,0.02)',
            }}
          >
            <Container maxWidth='lg'>
              <Grid
                container
                spacing={6}
                alignItems='center'
                direction={reverse ? 'row-reverse' : 'row'}
              >
                {/* Text Column */}
                <Grid
                  item
                  xs={12}
                  md={6}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
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
                      <Icon sx={{ fontSize: 26, color: 'primary.main' }} />
                    </Box>
                    <Typography
                      variant='h4'
                      sx={{ fontWeight: 700 }}
                    >
                      {section.title}
                    </Typography>
                  </Box>

                  {section.paragraphs.map((p, pIdx) => (
                    <Typography
                      key={pIdx}
                      variant='body1'
                      color='text.secondary'
                      sx={{
                        mb: pIdx < section.paragraphs.length - 1 ? 2 : 3,
                        lineHeight: 1.8,
                      }}
                    >
                      {p}
                    </Typography>
                  ))}

                  <Link
                    href={section.docsLink}
                    color='primary'
                    variant='body2'
                    sx={{ fontWeight: 600 }}
                  >
                    Read the docs &rarr;
                  </Link>
                </Grid>

                {/* Code Column */}
                <Grid
                  item
                  xs={12}
                  md={6}
                >
                  <CodeBlock
                    code={section.code}
                    language={section.codeLang || 'typescript'}
                  />
                </Grid>
              </Grid>
            </Container>
          </Box>
        )
      })}
    </Box>
  </>
)

export default Features
