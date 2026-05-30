import type { ComponentType } from 'react'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import CardContent from '@mui/material/CardContent'
import IconBadge from '@TAF/components/Shared/IconBadge'

type Props = {
  title: string
  description: string
  icon: ComponentType<{ sx?: object }>
}

const FeatureCard = ({ icon, title, description }: Props) => (
  <Card
    sx={{
      height: '100%',
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': { transform: 'translateY(-4px)' },
    }}
  >
    <CardContent sx={{ p: 3 }}>
      <Box sx={{ mb: 2 }}>
        <IconBadge
          icon={icon}
          size={48}
          iconSize={28}
        />
      </Box>
      <Typography
        variant='h6'
        sx={{ mb: 1 }}
      >
        {title}
      </Typography>
      <Typography
        variant='body2'
        color='text.secondary'
      >
        {description}
      </Typography>
    </CardContent>
  </Card>
)

export default FeatureCard
