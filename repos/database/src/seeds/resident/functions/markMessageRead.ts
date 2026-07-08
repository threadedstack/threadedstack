import { EFunLanguage } from '@tdsk/domain'

/**
 * `markMessageRead` — resident effect Function (Resident Agents R3, spec §2).
 *
 * Read receipt: patches `readAt` on ONE `agent_messages` record — but only a
 * message addressed TO the platform-injected caller (`data.to ===
 * caller.agentId`). A missing message is a benign no-op (the inbox may have
 * been pruned); a message addressed to someone else is a hard refusal; an
 * already-read message is left untouched (the first receipt wins).
 */
export const MarkMessageReadFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }

  const id = typeof args.id === 'string' ? args.id.trim() : ''
  if (!id) return { ok: false, reason: 'id is required' }

  const message = await records.get('agent_messages', id)
  if (!message) return { ok: true, marked: false, reason: 'message not found' }

  // Addressee gate — only the recipient may acknowledge its own mail.
  if (message.data.to !== caller.agentId)
    return { ok: false, reason: 'message is not addressed to caller' }

  if (message.data.readAt)
    return { ok: true, marked: false, reason: 'already read' }

  const data = Object.assign({}, message.data, {
    readAt: new Date().toISOString(),
  })
  await records.upsert('agent_messages', { id: id, data: data })
  return { ok: true, marked: true }
}
`

/** Seed record for the `markMessageRead` Function (stable id — idempotent reconcile). */
export const MarkMessageReadFunctionDef = {
  id: `fn_rmrkred`,
  name: `markMessageRead`,
  description: `Patch readAt on one agent_messages record as a read receipt — only when the message is addressed to the platform-injected caller. Missing message = benign no-op; wrong addressee = refusal; already-read = untouched.`,
  language: EFunLanguage.javascript,
  content: MarkMessageReadFunctionSource,
}
