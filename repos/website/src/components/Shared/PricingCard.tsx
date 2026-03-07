import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CheckIcon from '@mui/icons-material/Check'

type Feature = { label: string; included: boolean }

type Props = {
  name: string
  price: string
  description: string
  features: Feature[]
  cta: string
  highlighted?: boolean
  onCtaClick?: () => void
}

const PricingCard = ({
  name,
  price,
  description,
  features,
  cta,
  highlighted,
  onCtaClick,
}: Props) => (
  <Card
    sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'visible',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      '&:hover': { borderColor: 'primary.main' },
      ...(highlighted ? { borderColor: 'primary.main', borderWidth: 2 } : {}),
    }}
  >
    {highlighted && (
      <Chip
        label='Popular'
        color='primary'
        size='small'
        sx={{
          position: 'absolute',
          top: -12,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />
    )}
    <CardContent sx={{ p: 3, flex: 1 }}>
      <Typography
        variant='h6'
        sx={{ mb: 0.5 }}
      >
        {name}
      </Typography>
      <Typography
        variant='h4'
        sx={{ mb: 1 }}
      >
        {price}
      </Typography>
      <Typography
        variant='body2'
        color='text.secondary'
        sx={{ mb: 3 }}
      >
        {description}
      </Typography>
      {features.map((f) => (
        <Box
          key={f.label}
          sx={{
            display: 'flex',
            alignItems: 'center',
            mb: 1,
            opacity: f.included ? 1 : 0.4,
          }}
        >
          <CheckIcon
            sx={{
              fontSize: 18,
              mr: 1,
              color: f.included ? 'success.main' : 'text.disabled',
            }}
          />
          <Typography variant='body2'>{f.label}</Typography>
        </Box>
      ))}
    </CardContent>
    <CardActions
      className='tdsk-price-action'
      sx={{ px: 3, pb: 2, pt: 0, borderTop: `none` }}
    >
      <Button
        fullWidth
        variant={highlighted ? 'contained' : 'outlined'}
        onClick={onCtaClick}
      >
        {cta}
      </Button>
    </CardActions>
  </Card>
)

export default PricingCard
