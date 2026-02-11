import { Box, Button, Container, Typography, Link as MuiLink } from '@mui/material'
import { Link as RouterLink } from 'react-router'
import { ArrowUpward as UpgradeIcon } from '@mui/icons-material'
import { Page } from '@TAF/pages/Page/Page'
import { QuotaUsage } from '@TAF/components/Billing'
import { useActiveOrg } from '@TAF/state/selectors'
import { ERoutePath } from '@TAF/types'

export type TOrgUsage = {}

export const OrgUsage = (props: TOrgUsage) => {
  const [org] = useActiveOrg()

  if (!org) {
    return (
      <Page className='tdsk-org-usage-page'>
        <Container maxWidth='lg'>
          <Typography
            variant='h5'
            color='text.secondary'
          >
            No organization selected
          </Typography>
        </Container>
      </Page>
    )
  }

  return (
    <Page className='tdsk-org-usage-page'>
      <Container maxWidth='lg'>
        <Box sx={{ mb: 3 }}>
          <Typography
            variant='h4'
            component='h1'
            gutterBottom
          >
            {org.name} Usage
          </Typography>
          <Typography
            variant='body1'
            color='text.secondary'
          >
            Monitor your organization's resource usage and quota limits
          </Typography>
        </Box>

        <QuotaUsage orgId={org.id} />

        <Box
          sx={{
            mt: 4,
            p: 3,
            border: 1,
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography
              variant='h6'
              gutterBottom
            >
              Need more resources?
            </Typography>
            <Typography
              variant='body2'
              color='text.secondary'
            >
              Upgrade your plan to get higher limits and more features
            </Typography>
          </Box>
          <Button
            variant='contained'
            component={RouterLink}
            startIcon={<UpgradeIcon />}
            to={`/${ERoutePath.Billing}`}
          >
            Upgrade Plan
          </Button>
        </Box>
      </Container>
    </Page>
  )
}

export default OrgUsage
