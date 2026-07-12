import type { ComponentType } from 'react'

import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Link from '@mui/material/Link'
import { RobotIcon } from '@tdsk/components'
import Accordion from '@mui/material/Accordion'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import CableIcon from '@mui/icons-material/Cable'
import CloudIcon from '@mui/icons-material/Cloud'
import SyncIcon from '@mui/icons-material/Sync'
import DatasetIcon from '@mui/icons-material/Dataset'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import PageMeta from '@TAF/components/Shared/PageMeta'
import PageHero from '@TAF/components/Shared/PageHero'
import SecurityIcon from '@mui/icons-material/Security'
import BusinessIcon from '@mui/icons-material/Business'
import CodeBlock from '@TAF/components/Shared/CodeBlock'
import IconBadge from '@TAF/components/Shared/IconBadge'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import ScreenShareIcon from '@mui/icons-material/ScreenShare'

type FeatureSection = {
  code: string
  title: string
  benefit: string
  docsLink: string
  codeLang?: string
  expansion: string
  paragraphs: string[]
  icon: ComponentType<any>
}

const featureSections: FeatureSection[] = [
  {
    icon: CloudIcon,
    title: 'Managed Sandboxes',
    benefit:
      'One command to launch a sandboxed AI tool with SSH, file sync, and automatic shutdown.',
    expansion:
      'Every organization starts with six built-in presets: Claude Code, Codex, OpenCode, Antigravity, OpenClaw, and a base preset for custom runtimes. Sandboxes run as isolated K8s pods with configurable resources, idle timeouts, and per-project overrides.',
    paragraphs: [
      'Threaded Stack sandboxes are isolated K8s pods pre-configured to run AI tools. Each sandbox includes SSH access, a configurable working directory, resource limits (CPU/memory), and automatic idle shutdown. Six built-in presets cover the major AI tools — Claude Code, Codex, OpenCode, Antigravity, OpenClaw — plus a base preset for custom runtimes.',
      'Sandboxes are created per-organization and can be assigned to specific projects with per-project configuration overrides. This means a single sandbox definition can be reused across multiple projects, each with their own git repos, init scripts, and resource allocations.',
      'The lifecycle is simple: tsa run starts the pod, establishes SSH, syncs files, and launches the runtime command. When you disconnect, the pod continues running until the idle timeout expires, then shuts down automatically. Reconnecting to an active pod is instant.',
    ],
    code: `# List available sandbox presets
tsa sandbox --list
# → claude-code  | Claude Code     | Stopped
# → codex        | Codex           | Stopped
# → opencode     | OpenCode        | Stopped
# → antigravity  | Antigravity     | Stopped
# → openclaw     | OpenClaw        | Stopped
# → custom       | Custom Runtime  | Stopped

# Start a Claude Code sandbox
tsa run claude-code
# → Starting pod...
# → SSH connected. Syncing files...
# → Running: claude
# → Session ready: sess_abc123`,
    codeLang: 'bash',
    docsLink: '/docs/features/sandbox-connect',
  },
  {
    icon: SecurityIcon,
    title: 'Zero-Trust Egress Proxy',
    benefit:
      'Your AI tools work with placeholder tokens. Real credentials exist only in proxy memory for milliseconds.',
    expansion:
      'Every outbound HTTP request passes through an encrypted MITM proxy that replaces placeholder tokens with real secrets before forwarding. The sandbox never has access to actual credentials, even if the AI tool tries to print its environment.',
    paragraphs: [
      "Every outbound HTTP request from a sandbox pod passes through Threaded Stack's MITM egress proxy. The proxy inspects outbound traffic for placeholder tokens — strings matching the pattern tdsk_ph_* — and resolves them to real secret values before forwarding the request to its destination. This happens transparently; the AI tool inside the sandbox has no knowledge that its credentials are placeholders.",
      "This architecture provides defense-in-depth. Even if an AI coding tool is manipulated into revealing its environment variables or attempting credential exfiltration, it can only access placeholder values. The real credentials exist exclusively within the egress proxy's memory during the brief moment of request forwarding. They are never written to disk, never logged, and never exposed to the sandbox filesystem.",
      'The proxy supports domain allowlists per secret, so a credential configured for api.anthropic.com cannot be used in requests to any other domain. Combined with audit logging of every proxied request, this gives security teams full visibility into how AI tools interact with external services.',
    ],
    code: `# Inside the sandbox, the AI tool sees placeholders:
env | grep API_KEY
# → ANTHROPIC_API_KEY=tdsk_ph_sec_xyz_anthropic

# When the tool makes an API call:
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \\
  https://api.anthropic.com/v1/messages

# The egress proxy intercepts and:
# 1. Detects tdsk_ph_sec_xyz_anthropic in headers
# 2. Looks up secret → decrypts real value
# 3. Verifies api.anthropic.com is allowed
# 4. Replaces placeholder with real key in-flight
# 5. Forwards request to Anthropic
# 6. Returns response unchanged`,
    codeLang: 'bash',
    docsLink: '/docs/architecture/security-model',
  },
  {
    icon: VpnKeyIcon,
    title: 'Secret Management',
    benefit: 'Encrypted at rest, injected at runtime, redacted everywhere else.',
    expansion:
      'Secrets use AES-256-GCM encryption with per-entity derived keys. Three injection mechanisms (environment variable, file, and MITM proxy) give fine-grained control over how credentials reach each AI tool.',
    paragraphs: [
      'Secrets in Threaded Stack are encrypted at rest using AES-256-GCM with keys derived via HKDF from a master key. When a secret is created, it is encrypted immediately and the plaintext is never stored in the database. Secrets are scoped using an exclusive-arc pattern: each secret belongs to exactly one of an organization, project, or provider context.',
      'At runtime, secrets can be injected into sandbox pods through three mechanisms: direct environment variable injection, file-based injection (writing the secret to a specified path inside the container), or MITM injection via the egress proxy. The injection method is configurable per-secret and per-provider brand, allowing fine-grained control over how credentials reach the AI tool.',
      'Secret values are redacted in all API responses and logs. The admin dashboard shows secret metadata (name, scope, creation date) but never the value. Only the egress proxy and the direct-injection pipeline can decrypt secret values, and they do so transiently in memory.',
    ],
    code: `# Secrets are managed via the admin dashboard or API.
# The TSA CLI does not expose secret values.

# Example: org-scoped secret
# Name: ANTHROPIC_API_KEY
# Scope: Organization
# Injection: mitm (resolved by egress proxy)
# Allowed domains: api.anthropic.com

# Example: project-scoped secret
# Name: GITHUB_TOKEN
# Scope: Project
# Injection: direct (env var in pod)

# Example: file-injected credential
# Name: GCP_SERVICE_ACCOUNT
# Scope: Provider (Google Vertex)
# Injection: file → /tmp/gcloud-sa.json`,
    codeLang: 'bash',
    docsLink: '/docs/features/secrets',
  },
  {
    icon: RobotIcon,
    title: '21+ Provider Integrations',
    benefit:
      'Configure provider credentials once. Every sandbox gets the right environment variables automatically.',
    expansion:
      'Threaded Stack maps provider credentials to the correct environment variables for each runtime. Anthropic keys for Claude Code, OpenAI keys for Codex, Google keys for Antigravity. No manual env var configuration.',
    paragraphs: [
      'Each sandbox runtime has a mapping of supported LLM provider brands and the environment variables required to authenticate with them. Threaded Stack supports Anthropic (direct, via Bedrock, via Vertex), OpenAI, Google (Gemini API and Vertex AI), OpenRouter, Z.AI, Ollama (local and cloud), and custom providers with configurable base URLs.',
      'When you configure a provider credential for a sandbox, Threaded Stack automatically maps it to the correct environment variables for that runtime. For example, configuring an Anthropic credential for a Claude Code sandbox sets ANTHROPIC_API_KEY; the same credential configured for Bedrock access additionally sets AWS_REGION, CLAUDE_CODE_USE_BEDROCK, and the required AWS credential variables.',
      "This automation eliminates the tedious and error-prone process of remembering which environment variables each tool expects. Platform engineers configure provider auth once in the admin dashboard, and every developer's sandbox receives the correct credentials in the correct format automatically.",
    ],
    code: `# Supported runtimes and their providers:

# Claude Code:
#   anthropic, amazon-bedrock, google-vertex,
#   z.ai, openrouter, ollama, custom

# Codex:
#   openai, openrouter, google, z.ai, ollama

# OpenCode:
#   anthropic, openai, openrouter, z.ai, ollama

# Antigravity:
#   google, google-vertex

# OpenClaw:
#   anthropic, openai, google, openrouter, ollama

# Example: configure Anthropic via Bedrock
# Sets: CLAUDE_CODE_USE_BEDROCK=1
#        AWS_REGION, AWS_ACCESS_KEY_ID,
#        AWS_SECRET_ACCESS_KEY (via secret)`,
    codeLang: 'bash',
    docsLink: '/docs/features/providers',
  },
  {
    icon: SyncIcon,
    title: 'Bidirectional File Sync',
    benefit:
      'Edit locally, run remotely. AI-generated changes appear on your filesystem instantly.',
    expansion:
      "Mutagen-powered real-time sync keeps your local project and the sandbox's /workspace mount in lockstep. Configurable ignore patterns, conflict resolution, and pause/resume controls.",
    paragraphs: [
      "Threaded Stack uses Mutagen under the hood to provide real-time bidirectional file synchronization between your local machine and the sandbox pod. When you run tsa run, your local project directory is synced to the sandbox's /workspace mount. Any file you edit locally appears in the sandbox immediately; any file the AI tool generates or modifies appears on your local filesystem just as quickly.",
      'Sync is configurable with ignore patterns (to exclude node_modules, build artifacts, etc.), conflict resolution strategies, and watch mode. The tsa sync command provides status, pause/resume, and force-resync capabilities for fine-grained control.',
      'This architecture lets you use your preferred local editor and tools while the AI coding tool operates on the same files in a cloud environment with dedicated resources. The AI tool sees a complete project tree, generates changes, and those changes are available locally for review, commit, and deployment without any manual file transfer.',
    ],
    code: `# File sync starts automatically with tsa run
tsa run claude-code
# → Syncing ./my-project → /workspace

# Check sync status
tsa sync status
# → State: watching
# → Local: /Users/dev/my-project (1,247 files)
# → Remote: /workspace (1,247 files)
# → Last sync: 2s ago

# Pause sync temporarily
tsa sync pause

# Force immediate resync
tsa sync flush`,
    codeLang: 'bash',
    docsLink: '/docs/features/file-sync',
  },
  {
    icon: BusinessIcon,
    title: 'Team Management',
    benefit:
      'Configure credentials once; every developer gets the right setup automatically.',
    expansion:
      'Multi-tenant organizations with project-level overrides, role-based access control, and subscription-based quotas. Admins manage infrastructure; developers launch sandboxes.',
    paragraphs: [
      "Threaded Stack's multi-tenant design provides complete isolation between organizations. Each org has its own sandboxes, secrets, provider configurations, and member roster. Within an organization, projects offer a second level of grouping — sandbox configurations can be overridden per-project, and secrets can be scoped to individual projects.",
      'Role-based access control governs what each member can do. Admins manage org-wide settings, secrets, and sandbox configurations. Members can launch and use sandboxes but cannot modify credentials or infrastructure settings. This separation ensures that developers are productive without being exposed to sensitive configuration details.',
      'Subscription tiers scale with your team. The Free tier supports a single seat for personal use. Solo adds more projects and sessions. Pro introduces multi-seat with per-seat pricing. Team provides unlimited resources for larger organizations. Quotas are tracked in real-time and enforced at the API layer.',
    ],
    code: `# Organization hierarchy:
# Org (Acme Corp)
# ├── Project: Backend API
# │   ├── Sandbox: claude-code (custom config)
# │   └── Secrets: ANTHROPIC_API_KEY (project)
# ├── Project: Mobile App
# │   ├── Sandbox: codex (default config)
# │   └── Secrets: OPENAI_API_KEY (project)
# └── Org-wide secrets:
#     └── GITHUB_TOKEN (shared across projects)

# Invite a team member (via admin dashboard)
# Role: member → can run sandboxes
# Role: admin → can manage secrets & config`,
    codeLang: 'bash',
    docsLink: '/docs/features/organizations',
  },
  {
    icon: ScreenShareIcon,
    title: 'Session Sharing',
    benefit: 'Watch an AI tool work in real-time, from the CLI or browser.',
    expansion:
      'Multiple users attach to the same sandbox session with live PTY output. Public or private visibility, detach/reconnect with output replay, and cross-platform access between CLI and web.',
    paragraphs: [
      'When a sandbox session is running, any authorized user can attach to it from the TSA CLI or the Threads web UI. Every connected client sees the same PTY output in real time — keystrokes, command output, and control sequences are broadcast to all participants with minimal latency.',
      'Sessions support per-session visibility controls. Mark a session as public to allow any org member to connect, or keep it private so only the session owner can attach. Each session tracks its connected clients, and users can detach at any time without terminating the underlying process. When they reconnect, buffered terminal output is replayed so they never miss what happened while away.',
      'Cross-platform access means you can start a session from the CLI with tsa sessions connect and hand it off to a colleague viewing the same session in the Threads browser UI. Disconnected sessions persist for a configurable period, giving users time to switch devices or recover from network interruptions without losing their work.',
    ],
    code: `# Start a sandbox session
tsa run claude-code
# → Session: sess_k8j2m | private

# Share with org
tsa sessions share sess_k8j2m

# Teammate connects
tsa sessions connect sess_k8j2m
# → Connected (2 users in session)
# → Replaying 23 lines of buffered output...

# List all sessions
tsa sessions list
# → sess_k8j2m | my-sandbox  | public  | 2 users
# → sess_m9n3p | codex-dev   | private | 1 user`,
    codeLang: 'bash',
    docsLink: '/docs/features/session-sharing',
  },
  {
    icon: DatasetIcon,
    title: 'Collections & Records',
    benefit:
      'Give every agent run, Function, and schedule durable, queryable memory — without provisioning an external database.',
    expansion:
      'A Collection is a named, project-scoped set of JSON-document Records, with an optional schema for validated writes. The Admin API, agent tools, FaaS Functions, and schedule contextSources all read and write through the same scoped query engine.',
    paragraphs: [
      'A Collection is a named, project-scoped set of Records, each a JSON document with an id and timestamps. Attach an optional schema — typed fields, each markable required — and every write is validated against it; skip the schema and the collection accepts any document. This gives agents, Functions, and schedules a lightweight place to persist structured data without provisioning and wiring up an external database.',
      'Four access paths compile through the same host-side query engine: the Admin API, four dedicated agent tools (collectionQuery, collectionGet, collectionUpsert, collectionDelete), a FaaS Function’s injected context.records capability, and a schedule’s contextSources config. Every filter field is validated against a strict identifier charset and bound as a parameter, never string-interpolated, so the same small, injection-safe filter/sort/limit API is safe no matter which surface is querying it.',
      'This turns durable memory into a config change instead of a coding project: point a schedule’s contextSources at your own collection and its next cycle prompt gets a live, filtered view injected automatically; have an agent run upsert its findings and a later run, Function, or schedule can query them back. Every record is scoped to its own project, so one team’s collections are never visible to another’s.',
    ],
    code: `# Create a project-scoped collection (schema optional)
curl -X POST .../projects/<id>/collections \\
  -d '{
    "name": "leads",
    "schema": [{ "name": "email", "type": "string", "required": true }]
  }'

# Agents get 4 tools automatically: collectionQuery / Get / Upsert / Delete
# → an agent run persists a finding...
collectionUpsert("leads", { data: { email: "alice@example.com", status: "new" } })

# ...and a later run, Function, or schedule reads it back
curl -X POST .../collections/leads/records/query \\
  -d '{
    "where": [{ "field": "status", "op": "eq", "value": "new" }],
    "limit": 25
  }'
# → { "data": [{ "id": "rec_f6g7h8i9j0", "data": { "email": "alice@example.com", "status": "new" } }] }`,
    codeLang: 'bash',
    docsLink: '/docs/features/collections',
  },
  {
    icon: CableIcon,
    title: 'Agent Connectors',
    benefit:
      'An agent authors its own proxy Endpoint and stores its own credential — then calls that Endpoint immediately, with no human in the loop to allowlist it.',
    expansion:
      'Self-provisioning removes the ceiling of human-configured tools: a scheduled or resident agent can emit a tdsk-author-secret fence to store a credential it obtained as its own encrypted Secret, and a tdsk-author-endpoint fence to build its own proxy Endpoint — then reach it through the context.connect Function capability with zero allowlist, because authorship is authorization.',
    paragraphs: [
      'By default an agent’s tools are the ones a human configured for its project ahead of time. Agent Connectors remove that ceiling: an agent running in a scheduled cycle or a resident (live) session can author its own proxy Endpoint and store a credential it obtained as its own encrypted Secret — then call that Endpoint immediately, with no human round-trip to create it first.',
      'Every submission passes an SSRF check at author time (the same egress guard used at call time), a same-agent secret-ownership check, and a deterministic content scan before a row is written — an internal target, a cross-owner secret reference, or a leaked credential is rejected before the Endpoint ever exists. Agent-authored Endpoints are proxy-only and can only resolve secrets that same agent owns, never the project’s full secret set.',
      'A FaaS Function reaches an authored Endpoint through context.connect.invoke(ref, request) — there is deliberately no caller-supplied path, so the target host is fixed by the Endpoint’s stored configuration and a Function can only vary the query, headers, body, and method. Authorship is authorization: an agent-authored Endpoint needs no human allowlist entry to be reached by its own author.',
    ],
    code: `# 1. Agent obtains a credential during its run, then stores it as its own Secret
\`\`\`tdsk-author-secret
{ "name": "WEBHOOK_TOKEN", "value": "whsec_...", "description": "Obtained from webhook signup" }
\`\`\`

# 2. Same turn: agent builds its own proxy Endpoint referencing that secret
\`\`\`tdsk-author-endpoint
{
  "name": "my-webhook",
  "path": "/notify",
  "options": { "url": "https://hooks.example.com/notify" },
  "headers": { "Authorization": "Bearer {{ WEBHOOK_TOKEN:sec_xxxxxxxxxx }}" }
}
\`\`\`

# 3. A later Function execution calls it — zero allowlist, same-agent secrets only
context.connect.invoke('my-webhook', { method: 'POST', body: { event: 'run.completed' } })
# → { ok: true, status: 200, body: { received: true } }`,
    codeLang: 'bash',
    docsLink: '/docs/features/agent-connectors',
  },
]

const altBgSx = (t: any) =>
  t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'

const accordionSx = {
  mb: 2,
  bgcolor: 'transparent',
  '&::before': { display: 'none' },
} as const

const accordionSummarySx = {
  px: 0,
  minHeight: 'auto',
  '& .MuiAccordionSummary-content': { my: 0 },
} as const

const Features = () => (
  <>
    <PageMeta
      title='Features'
      description="Explore Threaded Stack's platform capabilities: managed sandboxes, zero-trust egress proxy, secret management, provider integrations, file sync, team management, real-time session sharing, and queryable Collections & Records."
    />
    <Box>
      <PageHero
        overline='PLATFORM CAPABILITIES'
        title='The Sandbox Platform, Under the Hood'
        subtitle='A deep dive into how Threaded Stack secures your AI tools, manages credentials, and keeps your team in sync.'
      />

      {featureSections.map((section, idx) => (
        <Box
          key={section.title}
          component='section'
          sx={{
            py: { xs: 6, md: 10 },
            bgcolor: idx % 2 === 0 ? 'transparent' : altBgSx,
          }}
        >
          <Container maxWidth='lg'>
            <Grid
              container
              spacing={6}
              alignItems='center'
              direction={idx % 2 === 1 ? 'row-reverse' : 'row'}
            >
              <Grid
                item
                xs={12}
                md={6}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <IconBadge icon={section.icon} />
                  <Typography
                    variant='h4'
                    sx={{ fontWeight: 700 }}
                  >
                    {section.title}
                  </Typography>
                </Box>

                <Typography
                  variant='h6'
                  sx={{ mb: 1.5, fontWeight: 600, lineHeight: 1.5 }}
                >
                  {section.benefit}
                </Typography>
                <Typography
                  variant='body1'
                  color='text.secondary'
                  sx={{ mb: 2, lineHeight: 1.8 }}
                >
                  {section.expansion}
                </Typography>

                <Accordion
                  disableGutters
                  elevation={0}
                  sx={accordionSx}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={accordionSummarySx}
                  >
                    <Typography
                      variant='body2'
                      color='primary'
                      sx={{ fontWeight: 600 }}
                    >
                      Under the hood
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0, pt: 1 }}>
                    {section.paragraphs.map((p, pIdx) => (
                      <Typography
                        key={pIdx}
                        variant='body2'
                        color='text.secondary'
                        sx={{
                          mb: pIdx < section.paragraphs.length - 1 ? 1.5 : 0,
                          lineHeight: 1.8,
                        }}
                      >
                        {p}
                      </Typography>
                    ))}
                  </AccordionDetails>
                </Accordion>

                <Link
                  href={section.docsLink}
                  color='primary'
                  variant='body2'
                  sx={{ fontWeight: 600 }}
                >
                  Read the docs &rarr;
                </Link>
              </Grid>

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
      ))}
    </Box>
  </>
)

export default Features
