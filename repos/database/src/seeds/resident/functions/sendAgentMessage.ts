import { EFunLanguage } from '@tdsk/domain'

/**
 * `sendAgentMessage` — resident effect Function (Resident Agents R3, spec §2).
 *
 * Writes one `agent_messages` inbox record. Caller trust model: `from` is
 * ALWAYS the platform-injected `context.caller.agentId` — a sender can never
 * spoof another agent's identity because the model-emitted args carry no
 * authority. Deliberately board/loop-agnostic: there is NO membership gate —
 * ANY project agent whose allowlist carries this Function may message any
 * other agent in the project (delivery = the recipient's inbox watch).
 */
export const SendAgentMessageFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  // Caller trust — the platform-injected identity is the ONLY sender stamp.
  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }

  const to = typeof args.to === 'string' ? args.to.trim() : ''
  const body = typeof args.body === 'string' ? args.body.trim() : ''
  const subject = typeof args.subject === 'string' ? args.subject.trim() : ''
  if (!to || !body) return { ok: false, reason: 'to and body are required' }

  const refs = Array.isArray(args.refs)
    ? args.refs.filter((ref) => typeof ref === 'string')
    : []

  const created = await records.upsert('agent_messages', {
    data: {
      to: to,
      from: caller.agentId,
      subject: subject.slice(0, 200),
      body: body.slice(0, 20000),
      refs: refs,
      readAt: null,
    },
  })
  return { ok: true, messageId: created.id }
}
`

/** Seed record for the `sendAgentMessage` Function (stable id — idempotent reconcile). */
export const SendAgentMessageFunctionDef = {
  id: `fn_rsndmsg`,
  name: `sendAgentMessage`,
  description: `Send an inbox message to another project agent: writes an agent_messages record with the caller stamped as \`from\` (platform-injected identity, never spoofable). Board/loop-agnostic — any project agent may message any other; delivery is the recipient's inbox watch.`,
  language: EFunLanguage.javascript,
  content: SendAgentMessageFunctionSource,
}
