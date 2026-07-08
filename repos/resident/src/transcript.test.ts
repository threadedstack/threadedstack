import { describe, it, expect } from 'vitest'

import { createTranscript } from './transcript'
import { makeConfig, makeFakeApi } from './testUtils'

describe(`transcript`, () => {
  it(`appends turn in/out through the configured appendTranscript Function`, async () => {
    const api = makeFakeApi()
    const transcript = createTranscript({
      api,
      getConfig: () =>
        makeConfig({ functions: { appendTranscript: `appendTranscript` } }),
    })

    await transcript.append({
      event: `agenda:board`,
      input: `the turn input`,
      output: `the turn output`,
    })

    expect(api.dispatched).toHaveLength(1)
    const action = api.dispatched[0][0]
    expect(action.function).toBe(`appendTranscript`)
    expect(action.args).toMatchObject({
      event: `agenda:board`,
      input: `the turn input`,
      output: `the turn output`,
    })
    expect(typeof action.args.at).toBe(`string`)
  })

  it(`tail-caps oversized fields`, async () => {
    const api = makeFakeApi()
    const transcript = createTranscript({
      api,
      maxChars: 10,
      getConfig: () =>
        makeConfig({ functions: { appendTranscript: `appendTranscript` } }),
    })

    await transcript.append({
      event: `e`,
      input: `0123456789ABCDEF`,
      output: `short`,
    })

    expect(api.dispatched[0][0].args.input).toBe(`6789ABCDEF`)
    expect(api.dispatched[0][0].args.output).toBe(`short`)
  })

  it(`skips (log-only) when no appendTranscript Function is configured`, async () => {
    const api = makeFakeApi()
    const transcript = createTranscript({ api, getConfig: () => makeConfig() })

    await transcript.append({ event: `e`, input: `i`, output: `o` })
    expect(api.dispatched).toHaveLength(0)
  })

  it(`a failed append never throws (never fails the turn)`, async () => {
    const api = makeFakeApi()
    api.onDispatch(() => ({ ok: false, status: 500, error: `down` }))
    const transcript = createTranscript({
      api,
      getConfig: () =>
        makeConfig({ functions: { appendTranscript: `appendTranscript` } }),
    })

    await expect(
      transcript.append({ event: `e`, input: `i`, output: `o` })
    ).resolves.toBeUndefined()
  })
})
