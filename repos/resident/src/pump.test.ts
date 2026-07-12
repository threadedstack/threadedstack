import { describe, it, expect, vi } from 'vitest'

import {
  createActionPump,
  parseAuthorFunctionBlock,
  parseAuthorSecretBlock,
  parseAuthorEndpointBlock,
} from './pump'
import { makeFakeApi, makeConfig } from './testUtils'

const actionsFence = (json: string) => `\`\`\`tdsk-actions\n${json}\n\`\`\``
const memoriesFence = (json: string) => `\`\`\`tdsk-memories\n${json}\n\`\`\``
const authorFence = (json: string) => `\`\`\`tdsk-author-function\n${json}\n\`\`\``
const endpointFence = (json: string) => `\`\`\`tdsk-author-endpoint\n${json}\n\`\`\``
const secretFence = (json: string) => `\`\`\`tdsk-author-secret\n${json}\n\`\`\``

const manyActions = (count: number) =>
  JSON.stringify(
    Array.from({ length: count }, (_, i) => ({ function: `fn${i}`, args: { i } }))
  )

describe(`action pump`, () => {
  it(`is a no-op when the output has no fenced blocks`, async () => {
    const api = makeFakeApi()
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(`just chatter, no fences`)

    expect(report.total).toBe(0)
    expect(api.dispatched).toHaveLength(0)
  })

  it(`dispatches parsed actions and reports successes`, async () => {
    const api = makeFakeApi()
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(
      actionsFence(`[{"function":"sendAgentMessage","args":{"to":"ag_2"}}]`)
    )

    expect(report).toEqual({
      total: 1,
      dispatched: 1,
      failed: 0,
      allowlistRejected: 0,
      discardedActionBlocks: 0,
      memoriesSkipped: 0,
      functionsAuthored: 0,
      functionsRejected: 0,
      secretsStored: 0,
      secretsRejected: 0,
      endpointsAuthored: 0,
      endpointsRejected: 0,
    })
    expect(api.dispatched).toHaveLength(1)
    expect(api.dispatched[0][0]).toEqual({
      function: `sendAgentMessage`,
      args: { to: `ag_2` },
    })
  })

  it(`reports discardedActionBlocks when only one tdsk-actions block is present`, async () => {
    const api = makeFakeApi()
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(
      actionsFence(`[{"function":"sendAgentMessage","args":{"to":"ag_2"}}]`)
    )

    expect(report.discardedActionBlocks).toBe(0)
  })

  it(`reports discardedActionBlocks when a turn emits multiple tdsk-actions blocks — only the last is dispatched`, async () => {
    const api = makeFakeApi()
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const text = `${actionsFence(`[{"function":"first","args":{}}]`)}\nchatter\n${actionsFence(
      `[{"function":"second","args":{}}]`
    )}`
    const report = await pump.pump(text)

    expect(report.discardedActionBlocks).toBe(1)
    expect(report.total).toBe(1)
    expect(api.dispatched).toHaveLength(1)
    expect(api.dispatched[0][0]).toEqual({ function: `second`, args: {} })
  })

  it(`reports discardedActionBlocks correctly for 3+ blocks in one turn`, async () => {
    const api = makeFakeApi()
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const text = [
      actionsFence(`[{"function":"first","args":{}}]`),
      actionsFence(`[{"function":"second","args":{}}]`),
      actionsFence(`[{"function":"third","args":{}}]`),
    ].join(`\nchatter\n`)
    const report = await pump.pump(text)

    expect(report.discardedActionBlocks).toBe(2)
    expect(api.dispatched[0][0]).toEqual({ function: `third`, args: {} })
  })

  it(`chunks dispatches to the endpoint's 20-action cap`, async () => {
    const api = makeFakeApi()
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(actionsFence(manyActions(45)))

    expect(api.dispatched.map((chunk) => chunk.length)).toEqual([20, 20, 5])
    expect(report.dispatched).toBe(45)
  })

  it(`retries transport failures with backoff, then succeeds`, async () => {
    const api = makeFakeApi()
    let attempts = 0
    api.onDispatch((actions) => {
      attempts += 1
      return attempts < 3
        ? { ok: false, status: 0, error: `ECONNREFUSED` }
        : { ok: true, status: 200, data: actions.map(() => ({ ok: true })) }
    })
    const slept: number[] = []
    const pump = createActionPump({
      api,
      getConfig: () => makeConfig(),
      sleepFn: async (ms) => {
        slept.push(ms)
      },
    })

    const report = await pump.pump(actionsFence(`[{"function":"f","args":{}}]`))

    expect(attempts).toBe(3)
    expect(slept).toEqual([1000, 5000])
    expect(report.dispatched).toBe(1)
    expect(report.failed).toBe(0)
  })

  it(`gives up after max attempts and counts the chunk failed`, async () => {
    const api = makeFakeApi()
    api.onDispatch(() => ({ ok: false, status: 503, error: `unavailable` }))
    const sleepFn = vi.fn().mockResolvedValue(undefined)
    const pump = createActionPump({ api, getConfig: () => makeConfig(), sleepFn })

    const report = await pump.pump(actionsFence(`[{"function":"f","args":{}}]`))

    expect(api.dispatched).toHaveLength(3)
    expect(report.failed).toBe(1)
    expect(report.dispatched).toBe(0)
  })

  it(`does NOT retry 4xx responses (terminal client errors)`, async () => {
    const api = makeFakeApi()
    api.onDispatch(() => ({ ok: false, status: 403, error: `forbidden` }))
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(actionsFence(`[{"function":"f","args":{}}]`))

    expect(api.dispatched).toHaveLength(1)
    expect(report.failed).toBe(1)
  })

  it(`counts allowlist rejections from per-action results`, async () => {
    const api = makeFakeApi()
    api.onDispatch(() => ({
      ok: true,
      status: 200,
      data: [{ ok: true }, { ok: false, error: `function not allowed: forbiddenFn` }],
    }))
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(
      actionsFence(`[{"function":"okFn","args":{}},{"function":"forbiddenFn","args":{}}]`)
    )

    expect(report.dispatched).toBe(1)
    expect(report.failed).toBe(1)
    expect(report.allowlistRejected).toBe(1)
  })

  it(`dispatches tdsk-memories through the configured writeMemory Function`, async () => {
    const api = makeFakeApi()
    const config = makeConfig({ functions: { writeMemory: `writeMemory` } })
    const pump = createActionPump({ api, getConfig: () => config })

    const report = await pump.pump(
      memoriesFence(`[{"text":"remember this","importance":8},{"text":""}]`)
    )

    expect(report.total).toBe(1)
    expect(api.dispatched[0][0]).toEqual({
      function: `writeMemory`,
      args: { text: `remember this`, importance: 8 },
    })
  })

  it(`logs-and-skips memories when no writeMemory Function is configured`, async () => {
    const api = makeFakeApi()
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(memoriesFence(`[{"text":"remember this"}]`))

    expect(report.memoriesSkipped).toBe(1)
    expect(report.total).toBe(0)
    expect(api.dispatched).toHaveLength(0)
  })

  it(`pumps actions and memories from the same turn output together`, async () => {
    const api = makeFakeApi()
    const config = makeConfig({ functions: { writeMemory: `writeMemory` } })
    const pump = createActionPump({ api, getConfig: () => config })

    const report = await pump.pump(
      `${actionsFence(`[{"function":"a","args":{}}]`)}\n${memoriesFence(`[{"text":"m"}]`)}`
    )

    expect(report.total).toBe(2)
    expect(api.dispatched[0].map((action) => action.function)).toEqual([
      `a`,
      `writeMemory`,
    ])
  })
})

describe(`parseAuthorFunctionBlock`, () => {
  const submission = {
    name: `scrapePage`,
    description: `Fetch a page`,
    language: `javascript`,
    content: `export default async () => ({ ok: true })`,
  }

  it(`parses an array of submissions`, () => {
    const parsed = parseAuthorFunctionBlock(authorFence(JSON.stringify([submission])))
    expect(parsed).toEqual([submission])
  })

  it(`parses a single-object fence`, () => {
    const parsed = parseAuthorFunctionBlock(authorFence(JSON.stringify(submission)))
    expect(parsed).toEqual([submission])
  })

  it(`defaults language to javascript and drops empty description`, () => {
    const parsed = parseAuthorFunctionBlock(
      authorFence(JSON.stringify({ name: `f`, content: `x`, description: `` }))
    )
    expect(parsed).toEqual([
      { name: `f`, content: `x`, language: `javascript`, description: undefined },
    ])
  })

  it(`drops entries missing a non-empty name or content`, () => {
    const parsed = parseAuthorFunctionBlock(
      authorFence(
        JSON.stringify([
          { name: ``, content: `x` },
          { name: `f` },
          { content: `x` },
          `not-an-object`,
          { name: `ok`, content: `y` },
        ])
      )
    )
    expect(parsed.map((r) => r.name)).toEqual([`ok`])
  })

  it(`returns [] for no fence or malformed JSON`, () => {
    expect(parseAuthorFunctionBlock(`no fences here`)).toEqual([])
    expect(parseAuthorFunctionBlock(authorFence(`{not json`))).toEqual([])
  })
})

describe(`author-function pump integration`, () => {
  const submission = {
    name: `scrapePage`,
    language: `javascript`,
    content: `export default async () => ({ ok: true })`,
  }

  it(`POSTs parsed submissions to the author endpoint and counts acceptance`, async () => {
    const api = makeFakeApi()
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(authorFence(JSON.stringify([submission])))

    expect(api.authored).toEqual([{ ...submission, description: undefined }])
    expect(report.functionsAuthored).toBe(1)
    expect(report.functionsRejected).toBe(0)
    // Authoring is not a dispatch action
    expect(report.total).toBe(0)
    expect(api.dispatched).toHaveLength(0)
  })

  it(`counts a platform rejection (scan/collision) without failing the pump`, async () => {
    const api = makeFakeApi()
    api.onAuthor(() => ({
      ok: false,
      status: 422,
      error: `authorFunction rejected by security scan`,
    }))
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(authorFence(JSON.stringify([submission])))

    expect(report.functionsAuthored).toBe(0)
    expect(report.functionsRejected).toBe(1)
  })

  it(`authors and dispatches from the same turn output`, async () => {
    const api = makeFakeApi()
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(
      `${authorFence(JSON.stringify([submission]))}\n${actionsFence(`[{"function":"updateResidentConfig","args":{"actions":["scrapePage"]}}]`)}`
    )

    expect(report.functionsAuthored).toBe(1)
    expect(report.dispatched).toBe(1)
    expect(api.authored).toHaveLength(1)
    expect(api.dispatched[0][0].function).toBe(`updateResidentConfig`)
  })
})

describe(`parseAuthorEndpointBlock`, () => {
  const submission = {
    name: `stripeCharge`,
    path: `/charge`,
    type: `http`,
    options: { url: `https://api.stripe.com/v1/charges`, method: `POST` },
    headers: { 'x-source': `resident` },
    description: `Create a charge`,
  }

  it(`parses an array of submissions`, () => {
    const parsed = parseAuthorEndpointBlock(endpointFence(JSON.stringify([submission])))
    expect(parsed).toEqual([submission])
  })

  it(`parses a single-object fence`, () => {
    const parsed = parseAuthorEndpointBlock(endpointFence(JSON.stringify(submission)))
    expect(parsed).toEqual([submission])
  })

  it(`defaults path to empty and drops empty type/headers/description`, () => {
    const parsed = parseAuthorEndpointBlock(
      endpointFence(
        JSON.stringify({
          name: `f`,
          options: { url: `https://x.test` },
          type: ``,
          description: ``,
        })
      )
    )
    expect(parsed).toEqual([
      {
        name: `f`,
        path: ``,
        options: { url: `https://x.test` },
        type: undefined,
        headers: undefined,
        description: undefined,
      },
    ])
  })

  it(`drops entries missing a non-empty name or options.url`, () => {
    const parsed = parseAuthorEndpointBlock(
      endpointFence(
        JSON.stringify([
          { name: ``, options: { url: `https://x.test` } },
          { name: `noOptions` },
          { name: `noUrl`, options: {} },
          { name: `emptyUrl`, options: { url: `` } },
          `not-an-object`,
          { name: `ok`, options: { url: `https://ok.test` } },
        ])
      )
    )
    expect(parsed.map((r) => r.name)).toEqual([`ok`])
  })

  it(`returns [] for no fence or malformed JSON`, () => {
    expect(parseAuthorEndpointBlock(`no fences here`)).toEqual([])
    expect(parseAuthorEndpointBlock(endpointFence(`{not json`))).toEqual([])
  })
})

describe(`parseAuthorSecretBlock`, () => {
  const submission = {
    name: `STRIPE_KEY`,
    value: `sk_live_realcredential`,
    description: `Stripe secret key`,
  }

  it(`parses an array of submissions`, () => {
    const parsed = parseAuthorSecretBlock(secretFence(JSON.stringify([submission])))
    expect(parsed).toEqual([submission])
  })

  it(`parses a single-object fence`, () => {
    const parsed = parseAuthorSecretBlock(secretFence(JSON.stringify(submission)))
    expect(parsed).toEqual([submission])
  })

  it(`drops empty description and preserves the value byte-for-byte`, () => {
    const parsed = parseAuthorSecretBlock(
      secretFence(
        JSON.stringify({ name: `K`, value: `  spaced-value  `, description: `` })
      )
    )
    expect(parsed).toEqual([
      { name: `K`, value: `  spaced-value  `, description: undefined },
    ])
  })

  it(`drops entries missing a non-empty name or value`, () => {
    const parsed = parseAuthorSecretBlock(
      secretFence(
        JSON.stringify([
          { name: ``, value: `x` },
          { name: `f` },
          { value: `x` },
          { name: `emptyValue`, value: `` },
          `not-an-object`,
          { name: `ok`, value: `y` },
        ])
      )
    )
    expect(parsed.map((r) => r.name)).toEqual([`ok`])
  })

  it(`returns [] for no fence or malformed JSON`, () => {
    expect(parseAuthorSecretBlock(`no fences here`)).toEqual([])
    expect(parseAuthorSecretBlock(secretFence(`{not json`))).toEqual([])
  })
})

describe(`author-secret pump integration`, () => {
  const submission = {
    name: `STRIPE_KEY`,
    value: `sk_live_realcredential`,
    description: `Stripe secret key`,
  }

  it(`POSTs parsed submissions to the author-secret endpoint and counts storage`, async () => {
    const api = makeFakeApi()
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(secretFence(JSON.stringify([submission])))

    expect(api.authoredSecrets).toEqual([submission])
    expect(report.secretsStored).toBe(1)
    expect(report.secretsRejected).toBe(0)
    // Storing a secret is not a dispatch action
    expect(report.total).toBe(0)
    expect(api.dispatched).toHaveLength(0)
  })

  it(`counts a platform rejection (scan/validation) without failing the pump`, async () => {
    const api = makeFakeApi()
    api.onAuthorSecret(() => ({
      ok: false,
      status: 422,
      error: `authorSecret rejected by name scan`,
    }))
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(secretFence(JSON.stringify([submission])))

    expect(report.secretsStored).toBe(0)
    expect(report.secretsRejected).toBe(1)
  })

  it(`never logs the secret value — only its name reaches the api`, async () => {
    const api = makeFakeApi()
    let seenValue: string | undefined
    api.onAuthorSecret((request) => {
      seenValue = request.value
      return {
        ok: true,
        status: 201,
        data: { secretId: `sc_1`, name: request.name, rotated: false },
      }
    })
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    await pump.pump(secretFence(JSON.stringify([submission])))

    // The value flows to the api (encrypted at rest server-side) but is never logged.
    expect(seenValue).toBe(submission.value)
  })
})

describe(`author-endpoint pump integration`, () => {
  const secretSubmission = { name: `API_KEY`, value: `sk_live_x` }
  const endpointSubmission = {
    name: `stripeCharge`,
    path: `/charge`,
    options: {
      url: `https://api.stripe.com/v1/charges`,
      auth: { secretId: `sc_test001` },
    },
  }

  it(`POSTs parsed submissions to the author-endpoint endpoint and counts acceptance`, async () => {
    const api = makeFakeApi()
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(endpointFence(JSON.stringify([endpointSubmission])))

    expect(api.authoredEndpoints).toEqual([
      {
        ...endpointSubmission,
        type: undefined,
        headers: undefined,
        description: undefined,
      },
    ])
    expect(report.endpointsAuthored).toBe(1)
    expect(report.endpointsRejected).toBe(0)
    expect(report.total).toBe(0)
    expect(api.dispatched).toHaveLength(0)
  })

  it(`counts a platform rejection (scan/SSRF/collision) without failing the pump`, async () => {
    const api = makeFakeApi()
    api.onAuthorEndpoint(() => ({
      ok: false,
      status: 422,
      error: `authorEndpoint rejected by egress guard`,
    }))
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(endpointFence(JSON.stringify([endpointSubmission])))

    expect(report.endpointsAuthored).toBe(0)
    expect(report.endpointsRejected).toBe(1)
  })

  it(`authors the secret BEFORE the endpoint so the endpoint can reference it`, async () => {
    const api = makeFakeApi()
    const order: string[] = []
    api.onAuthorSecret((request) => {
      order.push(`secret:${request.name}`)
      return {
        ok: true,
        status: 201,
        data: { secretId: `sc_test001`, name: request.name, rotated: false },
      }
    })
    api.onAuthorEndpoint((request) => {
      order.push(`endpoint:${request.name}`)
      return { ok: true, status: 201, data: { id: `ep_1`, name: request.name } }
    })
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(
      `${secretFence(JSON.stringify([secretSubmission]))}\n${endpointFence(JSON.stringify([endpointSubmission]))}`
    )

    expect(order).toEqual([`secret:API_KEY`, `endpoint:stripeCharge`])
    expect(report.secretsStored).toBe(1)
    expect(report.endpointsAuthored).toBe(1)
  })

  it(`authors an endpoint and dispatches from the same turn output`, async () => {
    const api = makeFakeApi()
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(
      `${endpointFence(JSON.stringify([endpointSubmission]))}\n${actionsFence(`[{"function":"noteEndpoint","args":{"name":"stripeCharge"}}]`)}`
    )

    expect(report.endpointsAuthored).toBe(1)
    expect(report.dispatched).toBe(1)
    expect(api.authoredEndpoints).toHaveLength(1)
    expect(api.dispatched[0][0].function).toBe(`noteEndpoint`)
  })
})
