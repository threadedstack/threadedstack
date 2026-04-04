import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import GitHubIcon from '@mui/icons-material/GitHub'
import { Link as RouterLink } from 'react-router'
import ThemeToggle from '@TAF/components/Header/ThemeToggle'

const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Features', to: '/features' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Use Cases', to: '/use-cases' },
    ],
  },
  {
    title: 'Docs',
    links: [
      { label: 'Getting Started', to: '/docs/user-guide/getting-started' },
      { label: 'API Reference', to: '/docs/user-guide/api-reference' },
      { label: 'Guides', to: '/docs/user-guide/admin-ui' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '#' },
      { label: 'Contact', to: '#' },
    ],
  },
]

const MarketingFooter = () => (
  <Box
    component='footer'
    sx={{
      bgcolor: (t) => (t.palette.mode === 'dark' ? '#1E2228' : '#f2f2f2'),
      borderTop: 1,
      borderColor: 'divider',
      mt: 'auto',
    }}
  >
    <Container
      maxWidth='lg'
      sx={{ py: 6 }}
    >
      <Grid
        container
        spacing={4}
      >
        <Grid
          item
          xs={12}
          md={4}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Box
              component='img'
              src='/logo.svg'
              alt='Threaded Stack'
              sx={{ width: 20, height: 20 }}
            />
            <Typography
              variant='subtitle2'
              sx={{ fontWeight: 700 }}
            >
              Threaded Stack
            </Typography>
          </Box>
          <Typography
            variant='body2'
            color='text.secondary'
            sx={{ mb: 2, maxWidth: 280 }}
          >
            The developer platform for building autonomous AI agents without
            infrastructure headaches.
          </Typography>
          <ThemeToggle />
        </Grid>
        {columns.map((col) => (
          <Grid
            item
            key={col.title}
            xs={6}
            md={2}
          >
            <Typography
              variant='overline'
              sx={{ mb: 1.5, display: 'block', letterSpacing: 1.5, fontSize: 11 }}
            >
              {col.title}
            </Typography>
            {col.links.map((link) => (
              <Link
                key={link.label}
                component={RouterLink}
                to={link.to}
                color='text.secondary'
                variant='body2'
                sx={{ display: 'block', mb: 1, '&:hover': { color: 'primary.main' } }}
              >
                {link.label}
              </Link>
            ))}
          </Grid>
        ))}
      </Grid>
    </Container>
    <Box sx={{ borderTop: 1, borderColor: 'divider', py: 2 }}>
      <Container
        maxWidth='lg'
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Typography
          variant='caption'
          color='text.secondary'
        >
          &copy; {new Date().getFullYear()} Threaded Stack. All rights reserved.
        </Typography>
        <IconButton
          size='small'
          href='https://github.com/threadedstack'
          target='_blank'
          sx={{ color: 'text.secondary' }}
        >
          <GitHubIcon fontSize='small' />
        </IconButton>
      </Container>
    </Box>
  </Box>
)

export default MarketingFooter
