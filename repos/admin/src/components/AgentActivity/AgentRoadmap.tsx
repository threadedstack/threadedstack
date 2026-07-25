import type { TAgentPlan, TAgentMilestone } from '@TAF/types/agentActivity.types'

import Box from '@mui/material/Box'
import { useState } from 'react'
import Collapse from '@mui/material/Collapse'
import Skeleton from '@mui/material/Skeleton'
import { Text, Chip } from '@tdsk/components'

export type TAgentRoadmap = {
  /** `undefined` = not fetched yet, `[]` = fetched and there is no roadmap. */
  plans?: TAgentPlan[]
}

type TChipTone = `success` | `warning` | `info` | `error` | `neutral` | `primary`

const kindTone = (kind?: string): TChipTone => {
  if (kind === `initiative`) return `info`
  if (kind === `company`) return `primary`
  if (kind === `gtm`) return `warning`
  return `neutral`
}

const statusTone = (status?: string): TChipTone => {
  const s = (status || ``).toLowerCase()
  if (s === `active`) return `success`
  if (s === `blocked`) return `error`
  if (s === `done` || s === `complete` || s === `shipped`) return `neutral`
  return `neutral`
}

/** Active plans first, then everything else, so the current focus is on top. */
const byFocus = (a: TAgentPlan, b: TAgentPlan) => {
  const rank = (p: TAgentPlan) => (p.status === `active` ? 0 : 1)
  return rank(a) - rank(b)
}

const milestoneLabel = (m: TAgentMilestone): string =>
  m.title || m.detail || (typeof m === `string` ? m : JSON.stringify(m))

const PlanCard = (props: { plan: TAgentPlan }) => {
  const { plan } = props
  const [open, setOpen] = useState(false)
  const milestones = Array.isArray(plan.milestones) ? plan.milestones : []
  const keyResults = Array.isArray(plan.keyResults) ? plan.keyResults : []
  const hasMore = Boolean(plan.notes) || milestones.length > 0 || keyResults.length > 0

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: `1px solid`,
        borderColor: `divider`,
        bgcolor: `background.paper`,
      }}
    >
      <Box sx={{ display: `flex`, alignItems: `center`, gap: 1, flexWrap: `wrap` }}>
        <Chip
          size='sm'
          tone={kindTone(plan.kind)}
          label={plan.kind || `plan`}
        />
        {plan.status && (
          <Chip
            size='sm'
            variant='outlined'
            tone={statusTone(plan.status)}
            label={plan.status}
          />
        )}
        {plan.owner && (
          <Text sx={{ fontSize: 11.5, color: `text.secondary` }}>{plan.owner}</Text>
        )}
      </Box>

      <Text sx={{ mt: 1, fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>
        {plan.title}
      </Text>

      {plan.objective && (
        <Text
          sx={{
            mt: 0.75,
            fontSize: 13,
            lineHeight: 1.55,
            color: `text.secondary`,
            ...(open
              ? {}
              : {
                  display: `-webkit-box`,
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: `vertical`,
                  overflow: `hidden`,
                }),
          }}
        >
          {plan.objective}
        </Text>
      )}

      <Collapse
        in={open}
        unmountOnExit
      >
        {milestones.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Text
              sx={{
                fontSize: 10,
                mb: 0.75,
                letterSpacing: 0.6,
                textTransform: `uppercase`,
                color: `text.secondary`,
              }}
            >
              Milestones ({milestones.length})
            </Text>
            <Box sx={{ display: `flex`, flexDirection: `column`, gap: 0.75 }}>
              {milestones.map((m, i) => (
                <Box
                  key={i}
                  sx={{ display: `flex`, alignItems: `center`, gap: 1 }}
                >
                  {m.status && (
                    <Chip
                      size='sm'
                      variant='outlined'
                      tone={statusTone(m.status)}
                      label={m.status}
                    />
                  )}
                  <Text sx={{ fontSize: 13 }}>{milestoneLabel(m)}</Text>
                  {m.size && (
                    <Text sx={{ fontSize: 11, color: `text.secondary` }}>{m.size}</Text>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {keyResults.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Text
              sx={{
                fontSize: 10,
                mb: 0.75,
                letterSpacing: 0.6,
                textTransform: `uppercase`,
                color: `text.secondary`,
              }}
            >
              Key results
            </Text>
            <Box
              component='ul'
              sx={{ m: 0, pl: 2.5, display: `flex`, flexDirection: `column`, gap: 0.5 }}
            >
              {keyResults.map((kr, i) => (
                <Text
                  key={i}
                  component='li'
                  sx={{ fontSize: 13, lineHeight: 1.5 }}
                >
                  {String(kr)}
                </Text>
              ))}
            </Box>
          </Box>
        )}

        {plan.notes && (
          <Box sx={{ mt: 1.5 }}>
            <Text
              sx={{
                fontSize: 10,
                mb: 0.5,
                letterSpacing: 0.6,
                textTransform: `uppercase`,
                color: `text.secondary`,
              }}
            >
              Notes
            </Text>
            <Text sx={{ fontSize: 12.5, lineHeight: 1.55, color: `text.secondary` }}>
              {plan.notes}
            </Text>
          </Box>
        )}
      </Collapse>

      {hasMore && (
        <Text
          onClick={() => setOpen((v) => !v)}
          sx={{
            mt: 1,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: `pointer`,
            color: `primary.main`,
            display: `inline-block`,
          }}
        >
          {open ? `Show less` : `Show milestones & details`}
        </Text>
      )}
    </Box>
  )
}

/**
 * The agent's roadmap: the plans it is working toward, active ones first. This
 * answers "what is it building" as opposed to the activity feed's "what did it
 * just do".
 */
export const AgentRoadmap = (props: TAgentRoadmap) => {
  const { plans } = props

  if (plans === undefined)
    return (
      <Box
        data-testid='agent-roadmap-skeleton'
        sx={{ display: `flex`, flexDirection: `column`, gap: 1.5 }}
      >
        <Skeleton variant='rounded' height={120} />
        <Skeleton variant='rounded' height={120} />
      </Box>
    )

  if (!plans.length)
    return (
      <Box
        sx={{
          py: 8,
          textAlign: `center`,
          borderRadius: 2,
          border: `1px dashed`,
          borderColor: `divider`,
        }}
      >
        <Text sx={{ fontSize: 15, fontWeight: 600 }}>No roadmap yet</Text>
        <Text sx={{ mt: 0.5, fontSize: 13, color: `text.secondary` }}>
          This agent has not authored any plans.
        </Text>
      </Box>
    )

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1.5 }}>
      {[...plans].sort(byFocus).map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
        />
      ))}
    </Box>
  )
}
