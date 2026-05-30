import type { Plan } from '@tdsk/domain'

import Grid from '@mui/material/Grid'
import PricingCard from './PricingCard'
import { buildTiers } from './pricingTiers'

type Props = {
  plans: Plan[]
}

const PricingTierGrid = ({ plans }: Props) => {
  const tiers = buildTiers(plans)

  return (
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
}

export default PricingTierGrid
