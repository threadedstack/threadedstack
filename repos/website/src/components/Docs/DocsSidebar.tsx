import { useState } from 'react'
import { useLocation, Link as RouterLink } from 'react-router'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Collapse from '@mui/material/Collapse'
import Typography from '@mui/material/Typography'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'

type NavItem = { label: string; path: string }
type NavSection = { title: string; items: NavItem[] }

const sections: NavSection[] = [
  {
    title: 'Getting Started',
    items: [
      { label: 'Introduction', path: '/docs/getting-started' },
      { label: 'Quick Start', path: '/docs/getting-started/quick-start' },
      { label: 'Installation', path: '/docs/getting-started/installation' },
    ],
  },
  {
    title: 'Concepts',
    items: [
      { label: 'Organizations', path: '/docs/concepts/organizations' },
      { label: 'Projects', path: '/docs/concepts/projects' },
      { label: 'Agents', path: '/docs/concepts/agents' },
      { label: 'Threads', path: '/docs/concepts/threads' },
      { label: 'Providers', path: '/docs/concepts/providers' },
      { label: 'Endpoints', path: '/docs/concepts/endpoints' },
      { label: 'Secrets', path: '/docs/concepts/secrets' },
    ],
  },
  {
    title: 'API Reference',
    items: [
      { label: 'Authentication', path: '/docs/api-reference/authentication' },
      { label: 'Organizations', path: '/docs/api-reference/organizations' },
      { label: 'Agents', path: '/docs/api-reference/agents' },
      { label: 'Threads', path: '/docs/api-reference/threads' },
    ],
  },
  {
    title: 'WebSocket',
    items: [
      { label: 'Connection', path: '/docs/websocket/connection' },
      { label: 'Client Events', path: '/docs/websocket/client-events' },
      { label: 'Server Events', path: '/docs/websocket/server-events' },
    ],
  },
  {
    title: 'Guides',
    items: [
      { label: 'Admin Dashboard', path: '/docs/guides/admin-dashboard' },
      { label: 'REPL CLI', path: '/docs/guides/repl-cli' },
      { label: 'Self-Hosting', path: '/docs/guides/self-hosting' },
    ],
  },
  {
    title: 'Changelog',
    items: [{ label: 'Release Notes', path: '/docs/changelog' }],
  },
]

const DocsSidebar = () => {
  const { pathname } = useLocation()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const section of sections) {
      initial[section.title] = section.items.some((item) =>
        pathname.startsWith(item.path)
      )
    }
    return initial
  })

  const toggle = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  return (
    <Box
      sx={{
        width: 240,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        display: { xs: 'none', md: 'block' },
        overflow: 'auto',
        py: 2,
        position: 'sticky',
        top: 64,
        height: 'calc(100vh - 64px)',
      }}
    >
      <List disablePadding>
        {sections.map((section) => (
          <Box key={section.title}>
            <ListItemButton
              onClick={() => toggle(section.title)}
              sx={{ py: 0.5, px: 2 }}
            >
              <Typography
                variant='overline'
                sx={{ fontSize: 11, letterSpacing: 1.5, flex: 1 }}
              >
                {section.title}
              </Typography>
              {openSections[section.title] ? (
                <ExpandLess sx={{ fontSize: 18 }} />
              ) : (
                <ExpandMore sx={{ fontSize: 18 }} />
              )}
            </ListItemButton>
            <Collapse in={openSections[section.title]}>
              <List disablePadding>
                {section.items.map((item) => {
                  const active = pathname === item.path
                  return (
                    <ListItemButton
                      key={item.path}
                      component={RouterLink}
                      to={item.path}
                      sx={{
                        py: 0.5,
                        pl: 3,
                        pr: 2,
                        borderLeft: active ? 3 : 3,
                        borderColor: active ? 'primary.main' : 'transparent',
                        bgcolor: active ? 'action.selected' : 'transparent',
                      }}
                    >
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          variant: 'body2',
                          fontSize: 13,
                          color: active ? 'primary.main' : 'text.secondary',
                          fontWeight: active ? 600 : 400,
                        }}
                      />
                    </ListItemButton>
                  )
                })}
              </List>
            </Collapse>
          </Box>
        ))}
      </List>
    </Box>
  )
}

export default DocsSidebar
