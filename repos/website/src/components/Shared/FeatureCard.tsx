import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import type { SvgIconComponent } from '@mui/icons-material'

type Props = {
  icon: SvgIconComponent
  title: string
  description: string
}

const FeatureCard = ({ icon: Icon, title, description }: Props) => (
  <Card
    sx={{
      height: '100%',
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': { transform: 'translateY(-4px)' },
    }}
  >
    <CardContent sx={{ p: 3 }}>
      <Box
        sx={{
          mb: 2,
          width: 48,
          height: 48,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: (t) =>
            t.palette.mode === 'dark' ? 'rgba(51,112,222,0.12)' : 'rgba(51,112,222,0.08)',
        }}
      >
        <Icon sx={{ fontSize: 28, color: 'primary.main' }} />
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
