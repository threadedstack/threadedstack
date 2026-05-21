import Box from '@mui/material/Box'
import { nav } from '@TTH/services/nav'
import { Avatar } from '@tdsk/components'
import Typography from '@mui/material/Typography'
import { useOrgId, useSandboxes } from '@TTH/state/selectors'

export type TSandboxCrumb = {
  sandboxId: string
  projectId: string
}

export const SandboxCrumb = (props: TSandboxCrumb) => {
  const { sandboxId, projectId } = props

  const [orgId] = useOrgId()
  const [sandboxes] = useSandboxes()
  const sandbox = sandboxes.find((s) => s.id === sandboxId)

  const label = sandbox?.name || sandboxId.slice(-8)

  const onClick = () => {
    if (orgId && projectId && sandboxId) nav.sandbox(orgId, projectId, sandboxId)
  }

  return (
    <Box
      onClick={onClick}
      sx={{
        display: `flex`,
        alignItems: `center`,
        gap: `6px`,
        cursor: `pointer`,
      }}
    >
      <Avatar
        name={label}
        identifier={sandboxId}
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
