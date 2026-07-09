import { EFunLanguage } from '@tdsk/domain'

/**
 * `writeMemory` — resident effect Function (durable recall).
 *
 * Persists one durable memory per call from a turn's ```tdsk-memories``` block:
 * appends a caller-stamped `resident_memories` record ({ text, importance 1-10,
 * kind?, meta?, at }). Records-only by construction (a Function's execution
 * context is `context.records`, never the pgvector memory service), so recall
 * happens through the session's contextSources reading the most recent/important
 * entries back into future turns — the learning that survives compaction.
 */
export const WriteMemoryFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }

  const text = typeof args.text === 'string' ? args.text.trim() : ''
  if (!text) return { ok: false, reason: 'text is required' }

  // Clamp importance into [1,10] (default 5); tail-cap text like the runtime.
  const rawImp = typeof args.importance === 'number' ? args.importance : 5
  const importance = Math.min(10, Math.max(1, Math.round(rawImp)))

  const created = await records.upsert('resident_memories', {
    data: {
      agentId: caller.agentId,
      text: text.slice(0, 20000),
      importance: importance,
      kind: typeof args.kind === 'string' ? args.kind.slice(0, 100) : null,
      meta: args.meta && typeof args.meta === 'object' ? args.meta : null,
      at: new Date().toISOString(),
    },
  })
  return { ok: true, memoryId: created.id }
}
`

/** Seed record for the `writeMemory` Function (stable id — idempotent reconcile). */
export const WriteMemoryFunctionDef = {
  id: `fn_rwrtmem`,
  name: `writeMemory`,
  description: `Append one caller-stamped resident_memories record ({ text, importance 1-10, kind?, meta?, at }) from a turn's tdsk-memories block. Durable recall, surfaced back into future turns via the session's contextSources. Records-only — Functions hold the records capability, not the memory service.`,
  language: EFunLanguage.javascript,
  content: WriteMemoryFunctionSource,
}
