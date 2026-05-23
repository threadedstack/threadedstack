import type { Sandbox, TSandboxInstance } from '@tdsk/domain'
import type { TSandboxStatus } from '@TTH/types'

import Box from '@mui/material/Box'
import { nav } from '@TTH/services/nav'
import { MonoFont } from '@TTH/constants/values'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import { ValidStatuses } from '@TTH/constants/sessions'
import { Memory, MoreHoriz } from '@mui/icons-material'
import { Avatar as TdskAvatar } from '@tdsk/components'
import { formatTimestamp } from '@TTH/utils/formatDate'
import { RowList, StatusChip } from '@TTH/components/PagePrimitives'

const toSandboxStatus = (state: string): TSandboxStatus => {
  return ValidStatuses.has(state.toLowerCase())
    ? (state.toLowerCase() as TSandboxStatus)
    : `stopped`
}

const InstanceColumns = [
  { label: `Instance`, width: `1.6fr` },
  { label: `Status`, width: `100px` },
  { label: `Spec`, width: `110px` },
  { label: `Owner`, width: `120px` },
  { label: `Started`, width: `130px` },
  { label: `Sessions`, width: `70px` },
  { label: ``, width: `32px` },
]

export type TInstanceList = {
  orgId: string
  sandbox: Sandbox
  sandboxId: string
  projectId: string
  instances: TSandboxInstance[]
}

export const InstanceList = (props: TInstanceList) => {
  const { orgId, sandbox, sandboxId, projectId, instances } = props

  const config = sandbox?.config
  const runtime = config?.runtime || `custom`
  const cpu = config?.resources?.limits?.cpu || config?.resources?.requests?.cpu || `-`
  const mem =
    config?.resources?.limits?.memory || config?.resources?.requests?.memory || `-`

  const specs = `${cpu} x ${mem}`

  return (
    <RowList columns={InstanceColumns}>
      {instances.map((instance, idx) => (
        <RowList.Row
          key={instance.instanceId}
          isLast={idx === instances.length - 1}
          onClick={() => nav.instance(orgId, projectId, sandboxId, instance.instanceId)}
        >
          {/* Instance */}
          <Box sx={{ display: `flex`, alignItems: `center`, gap: `10px` }}>
            <Memory sx={{ fontSize: 18, color: `text.secondary` }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: `13px`,
                  fontWeight: 600,
                  overflow: `hidden`,
                  whiteSpace: `nowrap`,
                  fontFamily: MonoFont,
                  textOverflow: `ellipsis`,
                }}
              >
                Instance {idx + 1}
              </Typography>
              <Typography
                sx={{
                  fontSize: `11px`,
                  color: `text.secondary`,
                  overflow: `hidden`,
                  textOverflow: `ellipsis`,
                  whiteSpace: `nowrap`,
                }}
              >
                {instance.instanceId.slice(-12)}
              </Typography>
            </Box>
          </Box>

          {/* Status */}
          <Box sx={{ display: `flex`, alignItems: `center` }}>
            <StatusChip
              status={toSandboxStatus(instance.state)}
              size='sm'
            />
          </Box>

          {/* Spec */}
          <Box sx={{ display: `flex`, alignItems: `center` }}>
            <Typography
              sx={{
                fontSize: `12px`,
                fontFamily: MonoFont,
                color: `text.secondary`,
              }}
            >
              {specs}
            </Typography>
          </Box>

          {/* Owner */}
          <Box sx={{ display: `flex`, alignItems: `center`, gap: `6px` }}>
            <TdskAvatar
              name={instance.userId || `?`}
              size='sm'
            />
            <Typography
              noWrap
              sx={{ fontSize: `12px` }}
            >
              {instance.userId ? instance.userId.slice(0, 8) : `-`}
            </Typography>
          </Box>

          {/* Started */}
          <Box sx={{ display: `flex`, alignItems: `center` }}>
            <Typography sx={{ fontSize: `12px`, color: `text.secondary` }}>
              {instance.sessions?.[0]?.connectedAt
                ? formatTimestamp(instance.sessions[0].connectedAt)
                : `-`}
            </Typography>
          </Box>

          {/* Sessions */}
          <Box sx={{ display: `flex`, alignItems: `center` }}>
            <Typography sx={{ fontSize: `13px`, fontWeight: 500 }}>
              {instance.sessions.length}
            </Typography>
          </Box>

          {/* Actions */}
          <Box sx={{ display: `flex`, alignItems: `center` }}>
            <IconButton
              disabled
              size='small'
              title='Coming soon'
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHoriz sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </RowList.Row>
      ))}
    </RowList>
  )
}
