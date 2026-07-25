import type { TTimelineEntry, TTimelineKind } from '@TAF/types/agentActivity.types'

import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import { Text, Chip } from '@tdsk/components'
import { useState, type MouseEvent } from 'react'
import ContentCopy from '@mui/icons-material/ContentCopy'
import ExpandMore from '@mui/icons-material/ExpandMore'
import { relativeTime, absoluteTime } from '@TAF/utils/agentActivity/formatTime'

/** The writer tail-caps transcript input/output at 20k chars, so a body at
 * exactly that length is almost certainly truncated and must say so. */
const TranscriptCap = 20_000

/** One visual language per source: badge tone + spine-dot colour (a standard
 * MUI palette key so it tracks the theme, light or dark). */
const KindMeta: Record<
  TTimelineKind,
  { tone: `info` | `warning` | `success`; dot: `info` | `warning` | `success` }
> = {
  turn: { tone: `info`, dot: `info` },
  message: { tone: `warning`, dot: `warning` },
  memory: { tone: `success`, dot: `success` },
}

export type TAgentTimelineEntry = {
  entry: TTimelineEntry
  expanded: boolean
  onToggle: () => void
}

/** A readable, copyable block of raw log content. */
const LogBlock = (props: { label?: string; value: string }) => {
  const [copied, setCopied] = useState(false)
  const onCopy = async (e: MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard?.writeText(props.value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard denied — the text is still selectable on screen */
    }
  }
  const truncated = props.value.length >= TranscriptCap

  return (
    <Box sx={{ mt: 1 }}>
      {props.label && (
        <Text
          sx={{
            fontSize: 10,
            mb: 0.5,
            letterSpacing: 0.6,
            textTransform: `uppercase`,
            color: `text.secondary`,
          }}
        >
          {props.label}
        </Text>
      )}
      <Box
        sx={{
          position: `relative`,
          borderRadius: 1,
          border: `1px solid`,
          borderColor: `divider`,
          bgcolor: `action.hover`,
        }}
      >
        <Tooltip title={copied ? `Copied` : `Copy`}>
          <IconButton
            size='small'
            onClick={onCopy}
            sx={{ position: `absolute`, top: 4, right: 4, opacity: 0.6 }}
          >
            <ContentCopy sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Box
          component='pre'
          sx={{
            m: 0,
            p: 1.5,
            pr: 5,
            fontSize: 12.5,
            lineHeight: 1.6,
            maxHeight: 360,
            overflow: `auto`,
            whiteSpace: `pre-wrap`,
            wordBreak: `break-word`,
            fontFamily: `ui-monospace, SFMono-Regular, Menlo, monospace`,
          }}
        >
          {props.value}
        </Box>
      </Box>
      {truncated && (
        <Text sx={{ mt: 0.5, fontSize: 11, color: `warning.main` }}>
          Capped at 20k characters by the transcript writer.
        </Text>
      )}
    </Box>
  )
}

/**
 * One row in the activity feed: a colour-coded spine node, the event title with
 * its kind badge and relative time, a one-line preview, and — on click — the
 * full transcript body (and the trigger input for turns). This is what makes the
 * feed a log you can scan and then read, instead of a wall of timestamps.
 */
export const AgentTimelineEntry = (props: TAgentTimelineEntry) => {
  const { entry, expanded, onToggle } = props
  const meta = KindMeta[entry.kind]
  const hasDetail = Boolean(entry.body || entry.input)

  return (
    <Box
      data-testid={`timeline-entry-${entry.id}`}
      onClick={onToggle}
      sx={{
        display: `flex`,
        gap: 1.5,
        width: `100%`,
        minWidth: 0,
        cursor: hasDetail ? `pointer` : `default`,
        px: 1,
        '&:hover': { bgcolor: hasDetail ? `action.hover` : `transparent` },
      }}
    >
      {/* Timeline spine: a continuous line with a coloured node per entry. */}
      <Box sx={{ position: `relative`, width: 18, flexShrink: 0 }}>
        <Box
          sx={{
            position: `absolute`,
            left: 8,
            top: 0,
            bottom: 0,
            width: `2px`,
            bgcolor: `divider`,
          }}
        />
        <Box
          sx={{
            position: `absolute`,
            left: 3,
            top: 16,
            width: 12,
            height: 12,
            borderRadius: `50%`,
            bgcolor: `${meta.dot}.main`,
            border: `2px solid`,
            borderColor: `background.paper`,
          }}
        />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, overflow: `hidden`, py: 1.25 }}>
        <Box sx={{ display: `flex`, alignItems: `center`, gap: 1 }}>
          <Chip
            size='sm'
            variant='outlined'
            tone={meta.tone}
            label={entry.kind}
          />
          <Text
            sx={{
              flex: 1,
              minWidth: 0,
              fontWeight: 600,
              fontSize: 13.5,
              overflow: `hidden`,
              whiteSpace: `nowrap`,
              textOverflow: `ellipsis`,
            }}
          >
            {entry.title}
          </Text>
          {entry.meta && (
            <Text sx={{ fontSize: 11.5, color: `text.secondary`, flexShrink: 0 }}>
              {entry.meta}
            </Text>
          )}
          <Tooltip title={absoluteTime(entry.at)}>
            <Text
              sx={{ fontSize: 11.5, color: `text.secondary`, flexShrink: 0 }}
            >
              {relativeTime(entry.at) || `—`}
            </Text>
          </Tooltip>
          {hasDetail && (
            <ExpandMore
              sx={{
                fontSize: 18,
                color: `text.secondary`,
                transition: `transform 150ms`,
                transform: expanded ? `rotate(180deg)` : `none`,
              }}
            />
          )}
        </Box>

        {!expanded && entry.summary && (
          <Text
            sx={{
              mt: 0.25,
              fontSize: 12.5,
              color: `text.secondary`,
              overflow: `hidden`,
              whiteSpace: `nowrap`,
              textOverflow: `ellipsis`,
            }}
          >
            {entry.summary}
          </Text>
        )}

        <Collapse
          in={expanded}
          unmountOnExit
        >
          {entry.body && <LogBlock value={entry.body} />}
          {entry.input && (
            <LogBlock
              label='Trigger input'
              value={entry.input}
            />
          )}
        </Collapse>
      </Box>
    </Box>
  )
}
