import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

type Props = {
  number: number
  title: string
  description: string
}

const StepItem = ({ number, title, description }: Props) => (
  <Box sx={{ textAlign: 'center', flex: 1, px: 2, position: `relative`, zIndex: 1 }}>
    <Box
      sx={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mx: 'auto',
        mb: 2,
        fontSize: '1.25rem',
        fontWeight: 700,
      }}
    >
      {number}
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
  </Box>
)

export default StepItem
