import type { TOpenSession } from '@TTH/types'
import type { Sandbox } from '@tdsk/domain'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Key from '@mui/icons-material/Key'
import Hub from '@mui/icons-material/Hub'
import Memory from '@mui/icons-material/Memory'
import Outlet from '@mui/icons-material/Outlet'
import { MonoFont } from '@TTH/constants/values'
import Typography from '@mui/material/Typography'
import Terminal from '@mui/icons-material/Terminal'
import ExpandMore from '@mui/icons-material/ExpandMore'
import ChevronRight from '@mui/icons-material/ChevronRight'
import { PortsSection } from '@TTH/components/SessionLayout/PortsSection'

export type TContextPanel = {
  orgId: string
  projectId: string
  session: TOpenSession
  sandbox: Sandbox | undefined
}

type TSectionProps = {
  title: string
  defaultOpen?: boolean
  icon: React.ReactNode
  children: React.ReactNode
}

const Section = (props: TSectionProps) => {
  const { icon, title, defaultOpen = true, children } = props
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Box sx={{ borderBottom: 1, borderColor: `divider` }}>
      <Box
        onClick={() => setOpen(!open)}
        sx={{
          display: `flex`,
          alignItems: `center`,
          gap: 1,
          px: `18px`,
          py: `10px`,
          cursor: `pointer`,
          userSelect: `none`,
          '&:hover': { bgcolor: `action.hover` },
        }}
      >
        {open ? (
          <ExpandMore sx={{ fontSize: 14, color: `text.secondary` }} />
        ) : (
          <ChevronRight sx={{ fontSize: 14, color: `text.secondary` }} />
        )}
        <Box sx={{ display: `flex`, alignItems: `center`, gap: `6px`, flex: 1 }}>
          <Box sx={{ display: `flex`, color: `text.secondary`, fontSize: 14 }}>
            {icon}
          </Box>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: `0.08em`,
              color: `text.secondary`,
              textTransform: `uppercase`,
            }}
          >
            {title}
          </Typography>
        </Box>
      </Box>
      {open && <Box sx={{ px: `18px`, pb: `16px` }}>{children}</Box>}
    </Box>
  )
}

type TInfoRow = {
  label: string
  value: React.ReactNode
  mono?: boolean
}

const InfoRow = (props: TInfoRow) => {
  const { label, value, mono = true } = props

  return (
    <Box
      sx={{
        py: `3px`,
        display: `flex`,
        alignItems: `baseline`,
        justifyContent: `space-between`,
      }}
    >
      <Typography sx={{ fontSize: 11.5, color: `text.secondary` }}>{label}</Typography>
      <Typography
        noWrap
        sx={{
          fontSize: 11.5,
          maxWidth: `60%`,
          textAlign: `right`,
          fontFamily: mono ? MonoFont : undefined,
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

const truncateId = (id: string) => {
  if (!id) return `-`
  return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id
}

export const ContextPanel = (props: TContextPanel) => {
  const { orgId, projectId, session, sandbox } = props

  return (
    <Box
      sx={{
        height: `100%`,
        overflowY: `auto`,
        bgcolor: `background.default`,
      }}
    >
      {/* SESSION section */}
      <Section
        icon={<Terminal sx={{ fontSize: 14 }} />}
        title='Session'
      >
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 0.25 }}>
          <InfoRow
            label='Name'
            value={session.runtime || `shell`}
          />
          <InfoRow
            label='ID'
            value={truncateId(session.sessionId)}
          />
          <InfoRow
            label='Status'
            value={
              <Typography
                component='span'
                sx={{
                  fontSize: 11.5,
                  fontFamily: MonoFont,
                  color: `success.main`,
                }}
              >
                active
              </Typography>
            }
          />
          <InfoRow
            label='Thread'
            value={truncateId(session.threadId)}
          />
          <InfoRow
            label='Visibility'
            value={session.visibility}
          />
        </Box>
      </Section>

      {/* INSTANCE & SANDBOX section */}
      <Section
        icon={<Memory sx={{ fontSize: 14 }} />}
        title='Instance & Sandbox'
      >
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 0.25 }}>
          <InfoRow
            label='Instance'
            value={truncateId(session.instanceId)}
          />
          {sandbox && (
            <>
              <InfoRow
                label='Sandbox'
                value={sandbox.name || truncateId(sandbox.id)}
              />
              {sandbox.config?.runtime && (
                <InfoRow
                  label='Runtime'
                  value={sandbox.config.runtime}
                />
              )}
              {sandbox.config?.image && (
                <InfoRow
                  label='Image'
                  value={sandbox.config.image}
                />
              )}
              {sandbox.config?.workdir && (
                <InfoRow
                  label='Workdir'
                  value={sandbox.config.workdir}
                />
              )}
              {sandbox.config?.idleTimeoutMinutes != null && (
                <InfoRow
                  label='Idle Timeout'
                  value={`${sandbox.config.idleTimeoutMinutes}m`}
                />
              )}
            </>
          )}
          {!sandbox && (
            <InfoRow
              label='Sandbox'
              value={truncateId(session.sandboxId)}
            />
          )}
        </Box>
      </Section>

      {/* PORTS section */}
      <Section
        icon={<Outlet sx={{ fontSize: 14 }} />}
        title='Ports'
      >
        <PortsSection
          orgId={orgId}
          projectId={projectId}
          sandboxId={session.sandboxId}
          instanceId={session.instanceId}
          portUrlTemplate={session.portUrlTemplate}
        />
      </Section>

      {/* ENVIRONMENT section */}
      <Section
        icon={<Key sx={{ fontSize: 14 }} />}
        title='Environment'
        defaultOpen={false}
      >
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1 }}>
          <EnvVarCard
            name='OPENAI_API_KEY'
            value='sk-****...****'
            masked
          />
          <EnvVarCard
            name='DATABASE_URL'
            value='postgres://****...****'
            masked
          />
          <EnvVarCard
            name='VECTOR_STORE'
            value='pinecone'
          />
        </Box>
      </Section>

      {/* RECENT TOOL CALLS section */}
      <Section
        icon={<Hub sx={{ fontSize: 14 }} />}
        title='Recent Tool Calls'
        defaultOpen={false}
      >
        <Box sx={{ display: `flex`, flexDirection: `column` }}>
          <ToolCallRow
            name='search_docs'
            latency='412ms'
          />
          <ToolCallRow
            name='fetch'
            latency='387ms'
          />
          <ToolCallRow
            name='search_docs'
            latency='298ms'
          />
          <Box sx={{ mt: 1.5, display: `flex`, flexDirection: `column`, gap: 0.25 }}>
            <InfoRow
              label='Total'
              value='14'
            />
            <InfoRow
              label='Proxied'
              value='12'
            />
            <InfoRow
              label='Avg latency'
              value='387ms'
            />
          </Box>
        </Box>
      </Section>
    </Box>
  )
}

type TEnvVarCard = {
  name: string
  value: string
  masked?: boolean
}

const EnvVarCard = (props: TEnvVarCard) => {
  const { name, value, masked } = props

  return (
    <Box
      sx={{
        border: 1,
        py: `8px`,
        px: `10px`,
        borderRadius: `6px`,
        borderColor: `divider`,
        bgcolor: `background.paper`,
      }}
    >
      <Typography
        sx={{
          fontSize: 11.5,
          fontWeight: 600,
          lineHeight: 1.3,
          fontFamily: MonoFont,
        }}
      >
        {name}
      </Typography>
      <Typography
        sx={{
          fontSize: 10.5,
          lineHeight: 1.3,
          fontFamily: MonoFont,
          color: `text.secondary`,
          mt: `2px`,
          ...(masked && { fontStyle: `italic` }),
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

type TToolCallRow = {
  name: string
  latency: string
}

const ToolCallRow = (props: TToolCallRow) => {
  const { name, latency } = props

  return (
    <Box
      sx={{
        py: `6px`,
        display: `flex`,
        alignItems: `baseline`,
        borderColor: `divider`,
        borderBottom: `1px dashed`,
        justifyContent: `space-between`,
      }}
    >
      <Typography
        sx={{
          fontSize: 12,
          fontFamily: MonoFont,
          color: `primary.main`,
        }}
      >
        {name}
      </Typography>
      <Typography
        sx={{
          fontSize: 11,
          fontFamily: MonoFont,
          color: `text.secondary`,
        }}
      >
        {latency}
      </Typography>
    </Box>
  )
}
