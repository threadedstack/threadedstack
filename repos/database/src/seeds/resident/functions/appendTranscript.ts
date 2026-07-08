import { EFunLanguage } from '@tdsk/domain'

/**
 * `appendTranscript` — resident effect Function (Resident Agents R3, spec §2).
 *
 * Turn observability: appends one `resident_transcripts` record per turn
 * ({ event, input, output, at }), caller-stamped. DECISION: the spec framed
 * this as a continuity-thread write, but a Function's execution context is
 * records-only (`context.records` — never threads/db), so the transcript
 * lands in the `resident_transcripts` collection instead: same audit trail,
 * queryable via the ① records API. Append semantics = a NEW record per call
 * (no id on the upsert), never a replace.
 */
export const AppendTranscriptFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }

  const event = typeof args.event === 'string' ? args.event.trim() : ''
  const input = typeof args.input === 'string' ? args.input : ''
  const output = typeof args.output === 'string' ? args.output : ''
  if (!event) return { ok: false, reason: 'event is required' }

  // Append = create (no id): one immutable record per turn, caller-stamped.
  // Tail-capped like the runtime's transcript fields (last 20k chars matter).
  const created = await records.upsert('resident_transcripts', {
    data: {
      agentId: caller.agentId,
      event: event.slice(0, 200),
      input: input.slice(-20000),
      output: output.slice(-20000),
      at: typeof args.at === 'string' && args.at ? args.at : new Date().toISOString(),
    },
  })
  return { ok: true, transcriptId: created.id }
}
`

/** Seed record for the `appendTranscript` Function (stable id — idempotent reconcile). */
export const AppendTranscriptFunctionDef = {
  id: `fn_rtrnscp`,
  name: `appendTranscript`,
  description: `Append one caller-stamped resident_transcripts record per turn ({ event, input, output, at }, tail-capped at 20k chars). Records-only stand-in for the continuity-thread write — Functions hold the records capability, not threads.`,
  language: EFunLanguage.javascript,
  content: AppendTranscriptFunctionSource,
}
