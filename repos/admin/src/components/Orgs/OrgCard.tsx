import type { Organization } from '@tdsk/domain'
import { deleteOrg } from '@TAF/actions/orgs/deleteOrg'
import {
  Group as OrgIcon,
  Delete as DeleteIcon,
  ArrowForward as SelectIcon,
} from '@mui/icons-material'
import {
  Box,
  Card,
  Chip,
  Tooltip,
  useTheme,
  IconButton,
  Typography,
  CardContent,
  CardActions,
} from '@mui/material'

export type TOrgCard = {
  active?: boolean
  org: Organization
  onSelect?: (orgId: string) => void
}

export const OrgCard = (props: TOrgCard) => {
  const { org, active, onSelect } = props

  const theme = useTheme()

  const onDeleteOrg = async (orgId: string, orgName: string) => {
    if (!window.confirm(`Are you sure you want to delete org "${orgName}"?`)) {
      return
    }
    await deleteOrg(orgId)
  }

  return (
    <Card
      sx={{
        cursor: `pointer`,
        transition: `all 0.2s`,
        border: active
          ? `2px solid ${theme.palette.primary.main}`
          : `1px solid rgba(0, 0, 0, 0.12)`,
        [`&:hover`]: {
          transform: `translateY(-4px)`,
          boxShadow: 3,
        },
      }}
      onClick={() => onSelect?.(org.id)}
    >
      <CardContent>
        <Box sx={{ display: `flex`, alignItems: `center`, mb: 1 }}>
          <OrgIcon sx={{ mr: 1, color: `primary.main` }} />
          <Typography
            variant='h6'
            component='h2'
            sx={{ flexGrow: 1 }}
          >
            {org.name}
          </Typography>
          {active && (
            <Chip
              size='small'
              label='Current'
              color='primary'
            />
          )}
        </Box>
        <Typography
          sx={{ mb: 1 }}
          variant='body2'
          color='text.secondary'
        >
          {org.description || `No description`}
        </Typography>
        <Typography
          variant='caption'
          color='text.secondary'
        >
          ID: {org.id}
        </Typography>
      </CardContent>
      <CardActions sx={{ justifyContent: `space-between`, px: 2, pb: 2 }}>
        <Tooltip title='Delete Org'>
          <IconButton
            size='small'
            color='error'
            onClick={() => onDeleteOrg(org.id, org.name)}
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={active ? `Continue with Org` : `Select Org`}>
          <IconButton
            size='small'
            color='primary'
            onClick={(e) => {
              e.stopPropagation()
              onSelect?.(org.id)
            }}
          >
            <SelectIcon />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  )
}
