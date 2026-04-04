import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Link from '@mui/material/Link'
import Chip from '@mui/material/Chip'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import ApiIcon from '@mui/icons-material/Api'
import CloudQueueIcon from '@mui/icons-material/CloudQueue'
import BusinessIcon from '@mui/icons-material/Business'
import type { SvgIconComponent } from '@mui/icons-material'
import CodeBlock from '@TAF/components/Shared/CodeBlock'
import PageMeta from '@TAF/components/Shared/PageMeta'

type UseCaseSection = {
  icon: SvgIconComponent
  title: string
  paragraphs: string[]
  scenario: string
  features: string[]
  code: string
  codeLang?: string
  docsLink: string
}

const useCaseSections: UseCaseSection[] = [
  {
    icon: SmartToyIcon,
    title: 'Autonomous AI Agents',
    paragraphs: [
      'Build agents that reason, plan, and act across multi-step workflows. Threaded Stack provides the complete runtime: conversation memory, tool execution, provider routing, and streaming responses. Your agents can call external APIs, query databases, execute code, and maintain context across long-running interactions — all without you managing infrastructure.',
      'Consider a customer support agent that monitors incoming tickets, searches a knowledge base for relevant articles, drafts a response, and escalates to a human when confidence is low. With Threaded Stack, this agent is defined declaratively — a system prompt, a set of tools, and a provider. The runtime handles the reasoning loop, tool invocation, and response streaming.',
      'Thread branching enables advanced workflows like A/B testing agent responses or letting users retry from an earlier point in a conversation. Combined with metadata tagging, you can build analytics pipelines that track agent performance across thousands of interactions.',
    ],
    scenario:
      'A fintech company deploys a compliance review agent that reads transaction reports, flags anomalies using custom functions, queries regulatory databases via secure API proxying, and generates audit summaries — all running autonomously with full conversation history.',
    features: [
      'AI Agent Runtime',
      'Threads & Memory',
      'Secrets Management',
      'Serverless Compute',
    ],
    code: `// Define a support agent with tools
const agent = await api.post('/_/agents', {
  name: 'Customer Support',
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  systemPrompt: \`You are a support agent. Use the
    search_kb tool to find answers, and escalate
    to a human if you are not confident.\`,
  tools: ['search_kb', 'create_ticket', 'escalate'],
})

// Run with streaming SSE
const stream = await api.post(
  \`/_/agents/\${agent.id}/run\`,
  { threadId: 'thread_123', message: userMessage },
  { responseType: 'stream' },
)`,
    docsLink: '/docs/features/agent-endpoints',
  },
  {
    icon: ApiIcon,
    title: 'Secure API Orchestration',
    paragraphs: [
      "Proxy and orchestrate calls to external APIs with automatic credential injection. Threaded Stack's proxy engine resolves secrets at runtime and injects them into outbound requests, so your agents and functions interact with third-party APIs without ever seeing raw credentials. This eliminates an entire class of security vulnerabilities.",
      'Define proxy endpoints that map to external APIs — Stripe for payments, Twilio for messaging, GitHub for repository management, or any REST API. Each endpoint specifies which secrets to inject and how (headers, query params, or body fields). The proxy handles authentication, rate limiting, error normalization, and response transformation.',
      'Because secrets are resolved server-side, your client code and AI agents never have access to API keys. Even if an agent is compromised or produces unexpected output, credentials remain safe inside the Threaded Stack secrets vault. Audit logs capture every proxied request for compliance and debugging.',
    ],
    scenario:
      'An e-commerce platform uses Threaded Stack to orchestrate an order fulfillment pipeline: an agent receives an order webhook, calls Stripe to verify payment, calls a shipping API to create a label, sends a confirmation via Twilio, and updates inventory in a PostgreSQL database — all through secure proxy endpoints.',
    features: [
      'Auth Proxy',
      'Secrets Management',
      'AI Agent Runtime',
      'Multi-Tenant Design',
    ],
    code: `// Create a proxy endpoint for Stripe
await api.post('/_/endpoints', {
  name: 'stripe-charges',
  type: 'proxy',
  target: 'https://api.stripe.com/v1/charges',
  method: 'POST',
  secrets: [{
    name: 'STRIPE_SECRET_KEY',
    inject: 'header',
    header: 'Authorization',
    prefix: 'Bearer ',
  }],
})

// Agent calls the proxy — never sees the key
const charge = await fetch('/proxy/stripe-charges', {
  method: 'POST',
  body: JSON.stringify({ amount: 2000, currency: 'usd' }),
})`,
    docsLink: '/docs/features/proxy-endpoints',
  },
  {
    icon: CloudQueueIcon,
    title: 'Serverless Functions',
    paragraphs: [
      'Deploy custom compute logic that runs in isolated sandboxes with zero infrastructure management. Threaded Stack supports two isolation levels: V8 isolates for lightweight, sub-millisecond-startup transformations, and Firecracker microVMs for workloads that need full OS capabilities including filesystem access and subprocess execution.',
      'Functions are first-class citizens in the platform. They can be triggered via HTTP endpoints, invoked by AI agents as tools, or chained together in pipelines. Each function receives a context object with the request payload, environment variables, and any injected secrets. The sandbox provides shims for common Node.js APIs so existing code often works without modification.',
      'The compute layer handles concurrency, timeout enforcement, and resource limits automatically. Execution logs, timing metrics, and error traces are captured for every invocation. Combined with the quota system, you get built-in cost control without building your own metering infrastructure.',
    ],
    scenario:
      'A data analytics company deploys webhook processors as serverless functions: incoming events from Segment, Mixpanel, and custom sources are transformed, enriched with data from internal APIs, and written to a data warehouse — all running in V8 isolates with sub-millisecond cold starts.',
    features: [
      'Serverless Compute',
      'Secrets Management',
      'Auth Proxy',
      'Multi-Tenant Design',
    ],
    code: `// Deploy a webhook processor
await api.post('/_/endpoints', {
  name: 'process-webhook',
  type: 'faas',
  runtime: 'isolate',
  code: \`
    export default async (ctx) => {
      const event = ctx.request.body

      // Transform and enrich
      const enriched = {
        ...event,
        processed_at: new Date().toISOString(),
        geo: await ctx.fetch('/proxy/geo-lookup', {
          body: JSON.stringify({ ip: event.ip }),
        }),
      }

      // Write to data warehouse
      await ctx.fetch('/proxy/warehouse-ingest', {
        method: 'POST',
        body: JSON.stringify(enriched),
      })

      return { status: 200, body: { ok: true } }
    }
  \`,
})`,
    docsLink: '/docs/features/faas-endpoints',
  },
  {
    icon: BusinessIcon,
    title: 'Multi-Tenant SaaS',
    paragraphs: [
      'Build multi-tenant products on Threaded Stack without implementing tenancy from scratch. Organizations provide complete isolation: each tenant gets their own agents, threads, secrets, endpoints, and quota limits. Role-based access control governs who can read, write, or administer resources, and invitation workflows handle onboarding new team members.',
      'Consider an AI writing assistant SaaS where each customer organization has its own agents configured with custom prompts and tools, isolated conversation threads, and organization-scoped secrets for third-party integrations. Threaded Stack handles the multi-tenancy layer so you can focus on the writing experience, not infrastructure.',
      'Subscription tiers and quota tracking are built in. Each organization is assigned a plan (Free, Basic, Developer, Pro) with defined limits across 12 resource types. Usage is tracked in real time and enforced at the API layer. Payment integration via Polar.sh handles billing, upgrades, and downgrades automatically.',
    ],
    scenario:
      'A startup launches an AI code review SaaS: each customer org has dedicated agents trained on their coding standards, project-scoped secrets for GitHub and CI/CD integration, isolated threads for review conversations, and tiered pricing that scales from free individual use to enterprise team plans.',
    features: [
      'Multi-Tenant Design',
      'AI Agent Runtime',
      'Secrets Management',
      'Threads & Memory',
    ],
    code: `// Set up a new customer tenant
const org = await api.post('/_/orgs', {
  name: 'Acme Writing Co',
  tier: 'developer',
})

// Create their writing agent
await api.post('/_/agents', {
  organizationId: org.id,
  name: 'Writing Assistant',
  provider: 'openai',
  model: 'gpt-4o',
  systemPrompt: 'You are a writing assistant...',
})

// Org-scoped secrets — isolated per tenant
await api.post('/_/secrets', {
  name: 'GRAMMARLY_KEY',
  value: 'grl_...',
  scope: 'organization',
  organizationId: org.id,
})

// Quotas are tracked automatically
// GET /_/quotas?orgId=org_xxx → usage per resource`,
    docsLink: '/docs/features/organizations',
  },
]

const UseCases = () => (
  <>
    <PageMeta
      title='Use Cases'
      description='Discover how teams use Threaded Stack to build autonomous AI agents, secure API orchestration, serverless functions, and multi-tenant SaaS platforms.'
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
            USE CASES
          </Typography>
          <Typography
            variant='h2'
            sx={{ mb: 2, fontWeight: 700 }}
          >
            Built for Real-World Applications
          </Typography>
          <Typography
            variant='body1'
            color='text.secondary'
            sx={{ maxWidth: 560, mx: 'auto' }}
          >
            See how teams use Threaded Stack to ship production AI systems — from
            autonomous agents to multi-tenant SaaS platforms.
          </Typography>
        </Container>
      </Box>

      {/* Use Case Sections */}
      {useCaseSections.map((section, idx) => {
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
                alignItems='flex-start'
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
                      sx={{ mb: 2, lineHeight: 1.8 }}
                    >
                      {p}
                    </Typography>
                  ))}

                  {/* Scenario walkthrough */}
                  <Box
                    sx={{
                      p: 2.5,
                      mb: 2.5,
                      borderRadius: 2,
                      border: 1,
                      borderColor: 'divider',
                      bgcolor: (t) =>
                        t.palette.mode === 'dark'
                          ? 'rgba(255,255,255,0.02)'
                          : 'rgba(0,0,0,0.02)',
                    }}
                  >
                    <Typography
                      variant='subtitle2'
                      sx={{ mb: 1, fontWeight: 700 }}
                    >
                      Example Scenario
                    </Typography>
                    <Typography
                      variant='body2'
                      color='text.secondary'
                      sx={{ lineHeight: 1.7 }}
                    >
                      {section.scenario}
                    </Typography>
                  </Box>

                  {/* Feature callouts */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    {section.features.map((f) => (
                      <Chip
                        key={f}
                        label={f}
                        size='small'
                        variant='outlined'
                        color='primary'
                      />
                    ))}
                  </Box>

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

export default UseCases
