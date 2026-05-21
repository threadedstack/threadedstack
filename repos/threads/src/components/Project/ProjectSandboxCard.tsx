import type { Sandbox } from '@tdsk/domain'

import { useCallback } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { nav } from '@TTH/services/nav'
import { MonoFont } from '@TTH/constants/values'
import Typography from '@mui/material/Typography'
import { Dataset, Public, Dns, Schedule } from '@mui/icons-material'
import { useSandboxHasSession } from '@TTH/hooks/sandbox/useSandboxHasSession'
import { PillMono, StatusChip, ResourceCard } from '@TTH/components/PagePrimitives'

export type TProjectSandboxCard = {
  sandbox: Sandbox
  orgId: string
  projectId: string
}

export const ProjectSandboxCard = (props: TProjectSandboxCard) => {
  const { sandbox, orgId, projectId } = props
  const running = useSandboxHasSession(sandbox.id)
  const config = sandbox.config
  const runtime = config?.runtime || `custom`
  const status = running ? `running` : `stopped`

  const cpu = config?.resources?.limits?.cpu || config?.resources?.requests?.cpu
  const memory = config?.resources?.limits?.memory || config?.resources?.requests?.memory
  const specs = cpu || memory ? `${cpu || `-`} / ${memory || `-`}` : undefined

  const handleClick = useCallback(() => {
    nav.sandbox(orgId, projectId, sandbox.id)
  }, [orgId, projectId, sandbox.id])

  return (
    <ResourceCard onClick={handleClick}>
      {/* Row 1: Icon + Name + Built-in chip */}
      <Box
        sx={{
          gap: `8px`,
          width: `100%`,
          display: `flex`,
          alignItems: `center`,
        }}
      >
        <Dataset sx={{ fontSize: 18, color: `text.secondary` }} />
        <Typography
          noWrap
          sx={{
            flex: 1,
            fontSize: `14px`,
            fontWeight: 600,
            fontFamily: MonoFont,
          }}
        >
          {sandbox.name}
        </Typography>
        {sandbox.builtIn && (
          <Chip
            size='small'
            color='info'
            label='Built-in'
            variant='outlined'
            sx={{ height: 20, fontSize: 10 }}
          />
        )}
      </Box>

      {/* Row 2: Description (if available) */}
      {config?.image && (
        <Typography
          noWrap
          sx={{
            fontSize: `12px`,
            color: `text.secondary`,
            maxWidth: `100%`,
          }}
          title={config.image}
        >
          {config.image}
        </Typography>
      )}

      {/* Row 3: Specs grid */}
      <Box
        sx={{
          display: `grid`,
          gridTemplateColumns: `1fr 1fr`,
          gap: `4px 12px`,
          width: `100%`,
        }}
      >
        {specs && (
          <Box sx={{ display: `flex`, alignItems: `center`, gap: `4px` }}>
            <Dns sx={{ fontSize: 12, color: `text.secondary` }} />
            <Typography sx={{ fontSize: `11px`, color: `text.secondary` }}>
              {specs}
            </Typography>
          </Box>
        )}
        <Box sx={{ display: `flex`, alignItems: `center`, gap: `4px` }}>
          <Public sx={{ fontSize: 12, color: `text.secondary` }} />
          <Typography sx={{ fontSize: `11px`, color: `text.secondary` }}>
            {`default`}
          </Typography>
        </Box>
        <Box sx={{ display: `flex`, alignItems: `center`, gap: `4px` }}>
          <Dataset sx={{ fontSize: 12, color: `text.secondary` }} />
          <Typography sx={{ fontSize: `11px`, color: `text.secondary` }}>
            {config?.maxInstances ?? 1} max
          </Typography>
        </Box>
        {config?.idleTimeoutMinutes != null && (
          <Box sx={{ display: `flex`, alignItems: `center`, gap: `4px` }}>
            <Schedule sx={{ fontSize: 12, color: `text.secondary` }} />
            <Typography sx={{ fontSize: `11px`, color: `text.secondary` }}>
              {config.idleTimeoutMinutes}m idle
            </Typography>
          </Box>
        )}
      </Box>

      {/* Row 4: Runtime + Status */}
      <Box
        sx={{
          display: `flex`,
          alignItems: `center`,
          width: `100%`,
          pt: `8px`,
          borderTop: `1px solid`,
          borderColor: `divider`,
        }}
      >
        <PillMono>{runtime}</PillMono>
        <Box sx={{ flex: 1 }} />
        <StatusChip
          status={status}
          size='sm'
        />
      </Box>
    </ResourceCard>
  )
}
