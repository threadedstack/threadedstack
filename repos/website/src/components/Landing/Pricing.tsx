import Link from '@mui/material/Link'
import Box from '@mui/material/Box'
import { Link as RouterLink } from 'react-router'
import SectionContainer from '@TAF/components/Shared/SectionContainer'
import SectionHeader from '@TAF/components/Shared/SectionHeader'
import PricingTierGrid from '@TAF/components/Shared/PricingTierGrid'

const Pricing = () => (
  <SectionContainer
    id='pricing'
    sx={{
      bgcolor: (t) =>
        t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
    }}
  >
    <SectionHeader
      overline='PRICING'
      title='Simple, Transparent Pricing'
      subtitle='Start free, scale as you grow. No hidden fees.'
    />
    <Box sx={{ mb: 4 }}>
      <PricingTierGrid />
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

export default Pricing
