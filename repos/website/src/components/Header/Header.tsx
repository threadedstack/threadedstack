import { useState } from 'react'
import { useLocation, Link as RouterLink } from 'react-router'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import MenuIcon from '@mui/icons-material/Menu'
import GitHubIcon from '@mui/icons-material/GitHub'
import { useTheme } from '@mui/material/styles'
import { useScrollPosition } from '@TAF/hooks/useScrollPosition'
import ThemeToggle from './ThemeToggle'
import MobileMenu from './MobileMenu'

const navItems = [
  { label: 'Features', path: '/features' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'Docs', path: '/docs' },
]

const Header = () => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const scrolled = useScrollPosition()
  const { pathname } = useLocation()
  const isLanding = pathname === '/'
  const solid = !isLanding || scrolled
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <AppBar
        position='sticky'
        elevation={0}
        sx={{
          height: 64,
          zIndex: 1300,
          bgcolor: solid ? 'background.paper' : 'transparent',
          borderBottom: solid ? 1 : 0,
          borderColor: 'divider',
          backdropFilter: solid ? 'blur(12px)' : 'none',
          transition: 'background-color 0.3s, border-bottom 0.3s, backdrop-filter 0.3s',
        }}
      >
        <Toolbar sx={{ height: 64, justifyContent: 'space-between' }}>
          <Box
            component={RouterLink}
            to='/'
            sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none' }}
          >
            <Box
              component='img'
              src='/logo.svg'
              alt='Threaded Stack'
              sx={{ width: 24, height: 24 }}
            />
            <Typography
              variant='subtitle1'
              sx={{ fontWeight: 700, ...(!isDark ? { color: 'text.primary' } : {}) }}
            >
              {isDark ? (
                <span className='gradient-text-dark'>Threaded Stack</span>
              ) : (
                'Threaded Stack'
              )}
            </Typography>
          </Box>

          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
            {navItems.map((item) => (
              <Button
                key={item.path}
                component={RouterLink}
                to={item.path}
                color='inherit'
                size='small'
                sx={{
                  color: pathname.startsWith(item.path)
                    ? 'primary.main'
                    : 'text.secondary',
                }}
              >
                {item.label}
              </Button>
            ))}
            <IconButton
              size='small'
              href='https://github.com'
              target='_blank'
              sx={{ color: 'text.secondary', ml: 0.5 }}
            >
              <GitHubIcon fontSize='small' />
            </IconButton>
            <ThemeToggle />
            <Button
              component={RouterLink}
              to='/docs/getting-started'
              variant='contained'
              size='small'
              sx={{ ml: 1 }}
            >
              Get Started
            </Button>
          </Box>

          <Box
            sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 0.5 }}
          >
            <ThemeToggle />
            <IconButton
              onClick={() => setMobileOpen(true)}
              sx={{ color: 'text.primary' }}
            >
              <MenuIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      <MobileMenu
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        navItems={navItems}
      />
    </>
  )
}

export default Header
