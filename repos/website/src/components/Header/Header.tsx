import { useState } from 'react'
import Box from '@mui/material/Box'
import MobileMenu from './MobileMenu'
import ThemeToggle from './ThemeToggle'
import AppBar from '@mui/material/AppBar'
import Button from '@mui/material/Button'
import Toolbar from '@mui/material/Toolbar'
import MenuIcon from '@mui/icons-material/Menu'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import GitHubIcon from '@mui/icons-material/GitHub'
import { TDSK_AD_APP_URL } from '@TAF/constants/envs'
import { useLocation, Link as RouterLink } from 'react-router'
import { useScrollPosition } from '@TAF/hooks/useScrollPosition'

const navItems = [
  { label: `Features`, path: `/features` },
  { label: `Pricing`, path: `/pricing` },
  { label: `Docs`, path: `/docs` },
]

const Header = () => {
  const { pathname } = useLocation()
  const isLanding = pathname === `/`
  const scrolled = useScrollPosition()
  const solid = !isLanding || scrolled
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <AppBar
        elevation={0}
        position='sticky'
        sx={{
          height: 64,
          zIndex: 1300,
          borderColor: 'divider',
          borderBottom: solid ? 1 : 0,
          backdropFilter: solid ? 'blur(12px)' : 'none',
          bgcolor: solid ? 'background.paper' : 'transparent',
          transition: 'background-color 0.3s, border-bottom 0.3s, backdrop-filter 0.3s',
        }}
      >
        <Toolbar sx={{ height: 64, justifyContent: 'space-between' }}>
          <Box
            to='/'
            component={RouterLink}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none' }}
          >
            <Box
              component='img'
              src='/logo.svg'
              alt='Threaded Stack'
              sx={{ width: 28, height: 28 }}
            />
            <Typography
              variant='h6'
              sx={{ fontSize: '18px', letterSpacing: '-1px', color: 'text.primary' }}
            >
              Threaded Stack
            </Typography>
          </Box>

          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
            {navItems.map((item) => (
              <Button
                size='small'
                to={item.path}
                color='inherit'
                key={item.path}
                component={RouterLink}
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
              target='_blank'
              href='https://github.com'
              sx={{ color: 'text.secondary', ml: 0.5 }}
            >
              <GitHubIcon fontSize='small' />
            </IconButton>
            <ThemeToggle />
            <Button
              size='small'
              sx={{ ml: 1 }}
              variant='contained'
              href={TDSK_AD_APP_URL}
            >
              Get Started
            </Button>
          </Box>

          <Box
            sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 0.5 }}
          >
            <ThemeToggle />
            <IconButton
              sx={{ color: 'text.primary' }}
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      <MobileMenu
        open={mobileOpen}
        navItems={navItems}
        onClose={() => setMobileOpen(false)}
      />
    </>
  )
}

export default Header
