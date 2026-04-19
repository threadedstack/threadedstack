import { Box, Button, Card, CardContent, Divider, Typography } from '@mui/material'

export type TDangerZoneCard = {
  title: string
  description: string
  buttonLabel: string
  disabled?: boolean
  onAction: () => void
}

export const DangerZoneCard = (props: TDangerZoneCard) => {
  const { title, disabled, onAction, description, buttonLabel } = props

  return (
    <Card sx={{ border: '1px solid', borderColor: 'error.main' }}>
      <CardContent>
        <Typography
          variant='h6'
          color='error'
        >
          Danger Zone
        </Typography>
        <Divider sx={{ my: 2 }} />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box>
            <Typography variant='body1'>{title}</Typography>
            <Typography
              variant='body2'
              color='text.secondary'
            >
              {description}
            </Typography>
          </Box>
          <Button
            variant='outlined'
            color='error'
            onClick={onAction}
            disabled={disabled}
          >
            {buttonLabel}
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}
