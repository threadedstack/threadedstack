import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Link from '@mui/material/Link'
import Chip from '@mui/material/Chip'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import BusinessIcon from '@mui/icons-material/Business'
import CloudQueueIcon from '@mui/icons-material/CloudQueue'
import ScreenShareIcon from '@mui/icons-material/ScreenShare'
import type { ComponentType } from 'react'
import CodeBlock from '@TAF/components/Shared/CodeBlock'
import PageMeta from '@TAF/components/Shared/PageMeta'

type UseCaseSection = {
  icon: ComponentType<any>
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
    icon: BusinessIcon,
    title: 'Platform Engineering',
    paragraphs: [
      'Platform engineering teams need to provide developers with standardized, secure environments for AI tools. Without Threaded Stack, each developer configures their own credentials, installs their own tool versions, and manages their own environment inconsistencies. This creates security blind spots and support burden.',
      'With Threaded Stack, platform engineers define sandbox presets at the organization level. Every developer in the org gets the same runtime configuration, the same resource limits, and the same credential injection pipeline. New developers are productive in seconds — just run tsa run and their sandbox is ready with all provider credentials pre-configured.',
      'Role-based access control ensures that only platform admins can modify sandbox configurations and secret values. Developers interact with pre-configured sandboxes without needing access to raw API keys or infrastructure details.',
    ],
    scenario:
      'A 50-person engineering team adopts AI tools. The platform team configures five sandbox presets — one per AI tool — with org-wide Anthropic and OpenAI credentials. New engineers run tsa login and tsa run on day one. No credential sharing over Slack. No environment setup guides. No security reviews per-developer.',
    features: ['Managed Sandboxes', 'Secret Management', 'Team Management', 'TSA CLI'],
    code: `# Platform engineer: configure org-wide sandbox
# presets via the admin dashboard or REST API

# Developer: one-time login
tsa login

# Developer: launch Claude Code sandbox
tsa run claude-code
# → Sandbox starting... (preset: Claude Code)
# → Syncing /Users/dev/project to /workspace...
# → Claude Code ready. Session: sess_abc123

# All credentials injected automatically
# via the egress proxy.
# Developer never sees ANTHROPIC_API_KEY`,
    codeLang: 'bash',
    docsLink: '/docs/features/sandbox-connect',
  },
  {
    icon: VpnKeyIcon,
    title: 'Secure Credential Management',
    paragraphs: [
      'AI tools need API keys to function — Anthropic keys for Claude Code, OpenAI keys for Codex, Google keys for Antigravity. Traditionally, developers store these in local .env files, share them over insecure channels, or hardcode them in configuration. Every key distribution is a potential leak vector.',
      'Threaded Stack eliminates this entire problem class. Secrets are encrypted at rest with AES-256-GCM and never injected directly into sandbox environments. Instead, the sandbox receives placeholder tokens. When the AI tool makes an outbound API call, the MITM egress proxy intercepts the request, replaces placeholder tokens with real credentials, and forwards the request to the provider.',
      'This architecture means that even if an AI tool is instructed to print its environment variables or exfiltrate data, it only has access to placeholder values — not real secrets. The actual credentials exist only transiently in proxy memory during request forwarding.',
    ],
    scenario:
      'A security-conscious fintech company needs developers to use Claude Code for assisted development but cannot risk API key exposure. They store all provider credentials in Threaded Stack, configure sandbox presets with MITM injection, and audit every outbound request through the egress proxy logs. No developer ever handles a raw API key.',
    features: [
      'Zero-Trust Egress Proxy',
      'Secret Management',
      'Provider Integrations',
      'Managed Sandboxes',
    ],
    code: `# What the sandbox sees in its environment:
echo $ANTHROPIC_API_KEY
# → tdsk_ph_sec_abc123_anthropic

# When Claude Code calls api.anthropic.com:
# 1. Request leaves sandbox → hits egress proxy
# 2. Proxy detects tdsk_ph_sec_abc123_anthropic
# 3. Proxy resolves to real key: sk-ant-api03-...
# 4. Request forwarded with real credentials
# 5. Response returned to sandbox unchanged

# The AI tool NEVER sees the real key.
# Even "env" or "printenv" only shows placeholders.`,
    codeLang: 'bash',
    docsLink: '/docs/architecture/security-model',
  },
  {
    icon: CloudQueueIcon,
    title: 'Remote AI Development',
    paragraphs: [
      'AI tools are resource-intensive. Running Claude Code or Codex locally competes with your IDE, build tools, and browser for CPU and memory. Cloud sandboxes give AI tools dedicated compute resources while keeping your local machine responsive.',
      "Threaded Stack sandboxes include bidirectional file sync powered by Mutagen. Your local project files are mirrored to the sandbox's /workspace directory in real-time. The AI tool operates on the synced files, and any changes it makes are immediately reflected on your local filesystem. It feels like running locally, but with cloud-grade resources.",
      'Sandbox pods are configurable: set CPU and memory limits, choose a base image, auto-clone a git repository, and define init scripts that run on startup. When you finish a session, the sandbox idles and stops automatically after a configurable timeout — you only use resources when actively developing.',
    ],
    scenario:
      'A developer is working on a large monorepo that takes 20 minutes to build locally. They launch a Codex sandbox with dedicated CPU and memory, sync their project, and let Codex generate code changes in the cloud while they continue reviewing PRs on their laptop. Changes appear locally in real-time via file sync.',
    features: ['Managed Sandboxes', 'File Sync', 'TSA CLI', 'Configurable Resources'],
    code: `# Launch a sandbox with file sync enabled
tsa run my-codex-sandbox
# → Syncing ./my-project to /workspace...
# → Watching for file changes (bidirectional)...
# → Codex runtime starting...

# Files sync in real-time:
# Local edit → sandbox /workspace (instant)
# AI-generated code → local filesystem (instant)

# Check sync status
tsa sync status
# → Active | Local: 1,247 files | Remote: 1,247 files

# SSH in for debugging
tsa ssh my-codex-sandbox`,
    codeLang: 'bash',
    docsLink: '/docs/features/file-sync',
  },
  {
    icon: ScreenShareIcon,
    title: 'Collaborative AI Sessions',
    paragraphs: [
      'AI-assisted development does not have to be a solo activity. Threaded Stack session sharing lets multiple developers observe and interact with the same sandbox session in real-time. One developer runs Claude Code in a sandbox; teammates connect via CLI or browser and see the same terminal output live.',
      'This is powerful for onboarding, pair programming, and knowledge sharing. A senior engineer can demonstrate AI-assisted workflows to the team by sharing their session publicly within the org. Junior developers watch the AI tool in action, see how prompts are structured, and learn effective patterns — all without needing their own sandbox session quota.',
      'Sessions support visibility controls (public within org or private), detach/reconnect with output replay, and cross-platform access. Start a session in the CLI, share the link, and teammates join from the Threads web UI. No screen-sharing tools needed.',
    ],
    scenario:
      'A team lead is using Claude Code to refactor a complex module. They share their session publicly within the org. Three teammates connect from the browser UI and watch the refactoring happen in real-time. They later reconnect to review the approach and extract prompting patterns for their own work.',
    features: ['Session Sharing', 'TSA CLI', 'Threads Web UI', 'Cross-Platform Access'],
    code: `# Developer A: start a sandbox and share it
tsa run claude-code
tsa sessions share sess_k8j2m
# → Session shared. Org members can connect.

# Developer B: list available sessions
tsa sessions list
# → sess_k8j2m | my-sandbox | public | 2 connected

# Developer B: connect from CLI
tsa sessions connect sess_k8j2m
# → Connected. Replaying 47 lines of output...

# Developer C: connects from Threads web UI
# All three see the same live terminal output`,
    codeLang: 'bash',
    docsLink: '/docs/features/session-sharing',
  },
]

const UseCases = () => (
  <>
    <PageMeta
      title='Use Cases'
      description='Discover how engineering teams use Threaded Stack to run AI tools in secure, managed sandbox environments with centralized credential management and real-time collaboration.'
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
            Built for How Teams Actually Use AI Tools
          </Typography>
          <Typography
            variant='body1'
            color='text.secondary'
            sx={{ maxWidth: 560, mx: 'auto' }}
          >
            See how engineering teams standardize and secure their AI coding tool
            environments.
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
