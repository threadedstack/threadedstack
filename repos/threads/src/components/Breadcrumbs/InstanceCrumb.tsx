import Box from '@mui/material/Box'
import { nav } from '@TTH/services/nav'
import { Avatar } from '@tdsk/components'
import { useOrgId } from '@TTH/state/selectors'
import Typography from '@mui/material/Typography'

export type TInstanceCrumb = {
  sandboxId: string
  projectId: string
  instanceId: string
}

export const InstanceCrumb = (props: TInstanceCrumb) => {
  const { sandboxId, projectId, instanceId } = props

  const [orgId] = useOrgId()

  const label = instanceId.slice(-8)

  const onClick = () => {
    if (orgId && projectId && sandboxId && instanceId)
      nav.instance(orgId, projectId, sandboxId, instanceId)
  }

  return (
    <Box
      onClick={onClick}
      sx={{
        gap: `6px`,
        display: `flex`,
        cursor: `pointer`,
        alignItems: `center`,
      }}
    >
      <Avatar
        name={label}
        identifier={instanceId}
        size='sm'
      />
      <Typography
        noWrap
        variant='body2'
        sx={{
          maxWidth: 150,
          color: `text.secondary`,
          '&:hover': { color: `text.primary` },
        }}
      >
        {label}
      </Typography>
    </Box>
  )
}
