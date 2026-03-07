import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { useLocation, Link as RouterLink } from 'react-router'

const allPages = [
  { path: '/docs/getting-started', label: 'Introduction' },
  { path: '/docs/getting-started/quick-start', label: 'Quick Start' },
  { path: '/docs/getting-started/installation', label: 'Installation' },
  { path: '/docs/concepts/organizations', label: 'Organizations' },
  { path: '/docs/concepts/projects', label: 'Projects' },
  { path: '/docs/concepts/agents', label: 'Agents' },
  { path: '/docs/concepts/threads', label: 'Threads' },
  { path: '/docs/concepts/providers', label: 'Providers' },
  { path: '/docs/concepts/endpoints', label: 'Endpoints' },
  { path: '/docs/concepts/secrets', label: 'Secrets' },
  { path: '/docs/api-reference/authentication', label: 'Authentication' },
  { path: '/docs/api-reference/organizations', label: 'API: Organizations' },
  { path: '/docs/api-reference/agents', label: 'API: Agents' },
  { path: '/docs/api-reference/threads', label: 'API: Threads' },
  { path: '/docs/websocket/connection', label: 'WS Connection' },
  { path: '/docs/websocket/client-events', label: 'Client Events' },
  { path: '/docs/websocket/server-events', label: 'Server Events' },
  { path: '/docs/guides/admin-dashboard', label: 'Admin Dashboard' },
  { path: '/docs/guides/repl-cli', label: 'REPL CLI' },
  { path: '/docs/guides/self-hosting', label: 'Self-Hosting' },
  { path: '/docs/changelog', label: 'Release Notes' },
]

const DocsPrevNext = () => {
  const { pathname } = useLocation()
  const idx = allPages.findIndex((p) => p.path === pathname)
  const prev = idx > 0 ? allPages[idx - 1] : null
  const next = idx < allPages.length - 1 ? allPages[idx + 1] : null

  if (!prev && !next) return null

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        mt: 6,
        pt: 3,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      {prev ? (
        <Button
          component={RouterLink}
          to={prev.path}
          startIcon={<ArrowBackIcon />}
          sx={{ textTransform: 'none' }}
        >
          {prev.label}
        </Button>
      ) : (
        <Box />
      )}
      {next ? (
        <Button
          component={RouterLink}
          to={next.path}
          endIcon={<ArrowForwardIcon />}
          sx={{ textTransform: 'none' }}
        >
          {next.label}
        </Button>
      ) : (
        <Box />
      )}
    </Box>
  )
}

export default DocsPrevNext
