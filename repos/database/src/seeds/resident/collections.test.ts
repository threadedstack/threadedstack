import { describe, it, expect } from 'vitest'

import { EFieldType } from '@tdsk/domain'
import {
  reconcileResident,
  ResidentCollectionDefs,
  AgentMessagesCollectionName,
  ResidentStatusCollectionName,
  ResidentConfigsCollectionName,
  ResidentTranscriptsCollectionName,
} from '@TDB/seeds/resident/collections'

/**
 * An in-memory fake of the collection service's getByName/create slice, keyed
 * by projectId+name — enough to prove the reconcile creates missing
 * Collections and leaves existing ones untouched without a live DB.
 */
const makeFakeService = () => {
  const rows = new Map<string, any>()
  const key = (projectId: string, name: string) => `${projectId}:${name}`
  return {
    rows,
    service: {
      collection: {
        getByName: async (projectId: string, name: string) => {
          const row = rows.get(key(projectId, name))
          return row ? { data: { ...row } } : {}
        },
        create: async (item: any) => {
          rows.set(key(item.projectId, item.name), { ...item })
          return { data: { ...item } }
        },
      },
    },
  }
}

describe(`ResidentCollectionDefs`, () => {
  it(`defines the four resident Collections with unique names + stable ids`, () => {
    expect(ResidentCollectionDefs).toHaveLength(4)
    expect(ResidentCollectionDefs.map((def) => def.name)).toEqual([
      ResidentConfigsCollectionName,
      AgentMessagesCollectionName,
      ResidentStatusCollectionName,
      ResidentTranscriptsCollectionName,
    ])
    const ids = ResidentCollectionDefs.map((def) => def.id)
    expect(new Set(ids).size).toBe(4)
    // Every id is a valid entity id (col_ prefix + 6 chars = 10-char id shape).
    for (const id of ids) expect(id).toMatch(/^col_[A-Za-z0-9_-]{6}$/)
  })

  it(`resident_configs carries the spec §2 record shape + the actions allowlist`, () => {
    const configs = ResidentCollectionDefs.find(
      (def) => def.name === ResidentConfigsCollectionName
    )!
    const fields = Object.fromEntries(configs.schema.map((f) => [f.name, f]))

    // agentId is the ONLY required field — a partial config is valid; the
    // runtime's normalizeResidentConfig defaults every missing section.
    expect(fields.agentId).toMatchObject({
      type: EFieldType.string,
      required: true,
    })
    for (const name of [`agenda`, `watches`, `actions`])
      expect(fields[name]).toMatchObject({ type: EFieldType.array })
    for (const name of [
      `inbox`,
      `compaction`,
      `session`,
      `subAgents`,
      `selfDirected`,
      `functions`,
    ])
      expect(fields[name]).toMatchObject({ type: EFieldType.object })
    expect(configs.schema.filter((f) => f.required)).toHaveLength(1)
  })

  it(`agent_messages requires to/from/body and carries refs + readAt`, () => {
    const messages = ResidentCollectionDefs.find(
      (def) => def.name === AgentMessagesCollectionName
    )!
    const fields = Object.fromEntries(messages.schema.map((f) => [f.name, f]))
    expect(fields.to).toMatchObject({ type: EFieldType.string, required: true })
    expect(fields.from).toMatchObject({ type: EFieldType.string, required: true })
    expect(fields.body).toMatchObject({ type: EFieldType.string, required: true })
    expect(fields.subject).toMatchObject({ type: EFieldType.string })
    expect(fields.refs).toMatchObject({ type: EFieldType.array })
    expect(fields.readAt).toMatchObject({ type: EFieldType.string })
  })

  it(`resident_status carries the heartbeat payload + the degraded flag`, () => {
    const status = ResidentCollectionDefs.find(
      (def) => def.name === ResidentStatusCollectionName
    )!
    const fields = Object.fromEntries(status.schema.map((f) => [f.name, f]))
    expect(fields.agentId).toMatchObject({ type: EFieldType.string, required: true })
    expect(fields.sessionId).toMatchObject({ type: EFieldType.string })
    expect(fields.queueDepth).toMatchObject({ type: EFieldType.number })
    expect(fields.currentActivity).toMatchObject({ type: EFieldType.string })
    expect(fields.lastTurnAt).toMatchObject({ type: EFieldType.string })
    expect(fields.turnCount).toMatchObject({ type: EFieldType.number })
    expect(fields.degraded).toMatchObject({ type: EFieldType.boolean })
  })

  it(`resident_transcripts requires agentId/event/at (the appendTranscript target)`, () => {
    const transcripts = ResidentCollectionDefs.find(
      (def) => def.name === ResidentTranscriptsCollectionName
    )!
    const fields = Object.fromEntries(transcripts.schema.map((f) => [f.name, f]))
    expect(fields.agentId).toMatchObject({ type: EFieldType.string, required: true })
    expect(fields.event).toMatchObject({ type: EFieldType.string, required: true })
    expect(fields.at).toMatchObject({ type: EFieldType.string, required: true })
    expect(fields.input).toMatchObject({ type: EFieldType.string })
    expect(fields.output).toMatchObject({ type: EFieldType.string })
  })
})

describe(`reconcileResident`, () => {
  it(`creates the four Collections when missing — and NO seed records`, async () => {
    const { service, rows } = makeFakeService()

    const summary = await reconcileResident(service, `pj_ops00001`)

    expect(summary).toMatchObject({
      collectionsCreated: 4,
      collectionsUnchanged: 0,
      errors: 0,
    })
    expect(rows.size).toBe(4)
    for (const def of ResidentCollectionDefs) {
      expect(rows.get(`pj_ops00001:${def.name}`)).toMatchObject({
        id: def.id,
        name: def.name,
        schema: def.schema,
        projectId: `pj_ops00001`,
      })
    }
  })

  it(`is idempotent — a re-run reports all four unchanged and writes nothing`, async () => {
    const { service, rows } = makeFakeService()

    await reconcileResident(service, `pj_ops00001`)
    const snapshot = new Map([...rows].map(([key, row]) => [key, { ...row }]))

    const second = await reconcileResident(service, `pj_ops00001`)

    expect(second).toMatchObject({
      collectionsCreated: 0,
      collectionsUnchanged: 4,
      errors: 0,
    })
    expect(rows.size).toBe(4)
    for (const [key, row] of snapshot) expect(rows.get(key)).toEqual(row)
  })

  it(`captures per-collection failures without aborting the run`, async () => {
    const { service } = makeFakeService()
    const failing = {
      collection: {
        getByName: service.collection.getByName,
        create: async (item: any) =>
          item.name === AgentMessagesCollectionName
            ? { error: new Error(`insert refused`) }
            : service.collection.create(item),
      },
    }

    const summary = await reconcileResident(failing, `pj_ops00001`)

    expect(summary.errors).toBe(1)
    expect(summary.collectionsCreated).toBe(3)
    const failed = summary.results.find((r) => r.action === `error`)
    expect(failed).toMatchObject({ name: AgentMessagesCollectionName })
    expect(failed?.message).toContain(`insert refused`)
  })
})
