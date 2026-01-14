import { Add as AddIcon } from '@mui/icons-material'
import { Card, Button, Typography, CardContent, CardActions } from '@mui/material'

export type TNoOrgs = {
  onCreate?: (evt: any) => void
}

export const NoOrgs = (props: TNoOrgs) => {
  const { onCreate } = props

  return (
    <Card>
      <CardContent>
        <Typography
          color='text.secondary'
          align='center'
          sx={{ mb: 2 }}
        >
          No organizations yet. Create your first organization to get started.
        </Typography>
      </CardContent>
      <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
        <Button
          color='primary'
          variant='contained'
          onClick={onCreate}
          startIcon={<AddIcon />}
        >
          Create
        </Button>
      </CardActions>
    </Card>
  )
}
