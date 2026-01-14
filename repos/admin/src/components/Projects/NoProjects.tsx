import { Add as AddIcon } from '@mui/icons-material'
import { Card, Button, Typography, CardContent, CardActions } from '@mui/material'

export type TNoProjects = {
  onCreate?: () => void
}

export const NoProjects = (props: TNoProjects) => {
  const { onCreate } = props

  return (
    <Card>
      <CardContent>
        <Typography
          color='text.secondary'
          align='center'
          sx={{ mb: 2 }}
        >
          No projects yet. Create your first project to get started.
        </Typography>
      </CardContent>
      <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
        <Button
          color='primary'
          variant='contained'
          onClick={onCreate}
          startIcon={<AddIcon />}
        >
          Create Project
        </Button>
      </CardActions>
    </Card>
  )
}
