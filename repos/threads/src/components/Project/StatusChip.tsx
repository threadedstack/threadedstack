import { Chip } from '@mui/material'

export const StatusChip = (props: { running: boolean }) => (
  <Chip
    size='small'
    sx={{ height: 22, fontSize: 11 }}
    label={props.running ? `Running` : `Stopped`}
    color={props.running ? `success` : `default`}
    variant={props.running ? `filled` : `outlined`}
  />
)
