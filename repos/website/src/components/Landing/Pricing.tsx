import type { Plan } from '@tdsk/domain'

import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import SectionHeader from '@TAF/components/Shared/SectionHeader'
import PricingTierGrid from '@TAF/components/Shared/PricingTierGrid'
import { Link as RouterLink, useRouteLoaderData } from 'react-router'
import SectionContainer from '@TAF/components/Shared/SectionContainer'

const Pricing = () => {
  const plans = (useRouteLoaderData(`marketing`) as Plan[]) ?? []

  return (
    <SectionContainer
      id='pricing'
      sx={{
        bgcolor: (t) =>
          t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
      }}
    >
      <SectionHeader
        overline='PRICING'
        title='Start free. Pay only when you scale.'
        subtitle='Every plan includes managed sandboxes, zero-trust credential injection, and file sync.'
      />
      <Box sx={{ mb: 4 }}>
        <PricingTierGrid plans={plans} />
      </Box>
      <Box sx={{ textAlign: 'center' }}>
        <Link
          component={RouterLink}
          to='/pricing'
          color='primary'
          variant='body2'
        >
          See full plan comparison →
        </Link>
      </Box>
    </SectionContainer>
  )
}

export default Pricing
