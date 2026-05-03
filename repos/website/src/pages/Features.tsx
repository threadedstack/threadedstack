import type { ComponentType } from 'react'

import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Link from '@mui/material/Link'
import { RobotIcon } from '@tdsk/components'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import CloudIcon from '@mui/icons-material/Cloud'
import SyncIcon from '@mui/icons-material/Sync'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import PageMeta from '@TAF/components/Shared/PageMeta'
import SecurityIcon from '@mui/icons-material/Security'
import BusinessIcon from '@mui/icons-material/Business'
import CodeBlock from '@TAF/components/Shared/CodeBlock'
import ScreenShareIcon from '@mui/icons-material/ScreenShare'

type FeatureSection = {
  code: string
  title: string
  docsLink: string
  codeLang?: string
  paragraphs: string[]
  icon: ComponentType<any>
}

const featureSections: FeatureSection[] = [
  {
    icon: CloudIcon,
    title: 'Managed Sandboxes',
    paragraphs: [
      'Threaded Stack sandboxes are isolated K8s pods pre-configured to run AI agents and tools. Each sandbox includes SSH access, a configurable working directory, resource limits (CPU/memory), and automatic idle shutdown. Five built-in presets cover the major AI tools — Claude Code, Codex, OpenCode, Gemini CLI — plus a base preset for custom runtimes.',
      'Sandboxes are created per-organization and can be assigned to specific projects with per-project configuration overrides. This means a single sandbox definition can be reused across multiple projects, each with their own git repos, init scripts, and resource allocations.',
      'The lifecycle is simple: tsa run starts the pod, establishes SSH, syncs files, and launches the runtime command. When you disconnect, the pod continues running until the idle timeout expires, then shuts down automatically. Reconnecting to an active pod is instant.',
    ],
    code: `# List available sandbox presets
tsa sandbox --list
# → claude-code  | Claude Code     | Stopped
# → codex        | Codex           | Stopped
# → opencode     | OpenCode        | Stopped
# → gemini-cli   | Gemini CLI      | Stopped
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
    paragraphs: [
      'Secrets in Threaded Stack are encrypted at rest using AES-256-GCM with keys derived via HKDF from a master key. When a secret is created, it is encrypted immediately and the plaintext is never stored in the database. Secrets are scoped using an exclusive-arc pattern: each secret belongs to exactly one of an organization, project, agent, or provider context.',
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

# Gemini CLI:
#   google, google-vertex

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
]

const Features = () => (
  <>
    <PageMeta
      title='Features'
      description="Explore Threaded Stack's platform capabilities: managed sandboxes, zero-trust egress proxy, secret management, provider integrations, file sync, team management, and real-time session sharing."
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
            The Sandbox Platform, Under the Hood
          </Typography>
          <Typography
            variant='body1'
            color='text.secondary'
            sx={{ maxWidth: 560, mx: 'auto' }}
          >
            A deep dive into the systems that make Threaded Stack the most secure way to
            run AI agents and tools.
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
