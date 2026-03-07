import Grid from '@mui/material/Grid'
import PricingCard from './PricingCard'
import { tiers } from './pricingTiers'

const PricingTierGrid = () => (
  <Grid
    container
    spacing={3}
  >
    {tiers.map((tier) => (
      <Grid
        item
        key={tier.name}
        xs={12}
        sm={6}
        lg={3}
      >
        <PricingCard {...tier} />
      </Grid>
    ))}
  </Grid>
)

export default PricingTierGrid
