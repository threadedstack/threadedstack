import { describe, it, expect } from 'vitest'
import { OpsReviewsBlockFence } from '@tdsk/domain'
import { parseOpsReviewsBlock } from './opsReview'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fenced = (fence: string, payload: unknown) =>
  `preamble\n\n\`\`\`${fence}\n${JSON.stringify(payload)}\n\`\`\`\ntrailer`

// ---------------------------------------------------------------------------
// parseOpsReviewsBlock
// ---------------------------------------------------------------------------

describe(`parseOpsReviewsBlock`, () => {
  it(`parses a valid block with approve=true and optional reason`, () => {
    const payload = [
      { opsActionId: `op_abc123`, approve: true, reason: `looks safe` },
      { opsActionId: `op_def456`, approve: false },
    ]
    const out = parseOpsReviewsBlock(fenced(OpsReviewsBlockFence, payload))
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({
      opsActionId: `op_abc123`,
      approve: true,
      reason: `looks safe`,
    })
    expect(out[1]).toEqual({ opsActionId: `op_def456`, approve: false })
  })

  it(`drops entries where opsActionId is missing`, () => {
    const payload = [
      { approve: true, reason: `no id here` },
      { opsActionId: `op_valid`, approve: true },
    ]
    const out = parseOpsReviewsBlock(fenced(OpsReviewsBlockFence, payload))
    expect(out).toHaveLength(1)
    expect(out[0].opsActionId).toBe(`op_valid`)
  })

  it(`drops entries where opsActionId is empty string`, () => {
    const payload = [{ opsActionId: ``, approve: true }]
    const out = parseOpsReviewsBlock(fenced(OpsReviewsBlockFence, payload))
    expect(out).toHaveLength(0)
  })

  it(`drops entries where opsActionId is whitespace-only`, () => {
    const payload = [{ opsActionId: `   `, approve: false }]
    const out = parseOpsReviewsBlock(fenced(OpsReviewsBlockFence, payload))
    expect(out).toHaveLength(0)
  })

  it(`drops entries where approve is not a boolean`, () => {
    const payload = [
      { opsActionId: `op_str`, approve: `yes` },
      { opsActionId: `op_num`, approve: 1 },
      { opsActionId: `op_null`, approve: null },
      { opsActionId: `op_undef` },
    ]
    const out = parseOpsReviewsBlock(fenced(OpsReviewsBlockFence, payload))
    expect(out).toHaveLength(0)
  })

  it(`returns [] for malformed JSON`, () => {
    const badBlock = `preamble\n\`\`\`${OpsReviewsBlockFence}\nnot-json!!!\n\`\`\`\ntrailer`
    expect(parseOpsReviewsBlock(badBlock)).toEqual([])
  })

  it(`returns [] when no block is present`, () => {
    expect(parseOpsReviewsBlock(`just a plain report`)).toEqual([])
  })

  it(`returns [] when block payload is a JSON object (not array)`, () => {
    const out = parseOpsReviewsBlock(
      fenced(OpsReviewsBlockFence, { opsActionId: `op_x`, approve: true })
    )
    expect(out).toEqual([])
  })

  it(`last-block-wins when two blocks are present`, () => {
    const block1 = `\`\`\`${OpsReviewsBlockFence}\n${JSON.stringify([{ opsActionId: `op_first`, approve: true }])}\n\`\`\``
    const block2 = `\`\`\`${OpsReviewsBlockFence}\n${JSON.stringify([{ opsActionId: `op_last`, approve: false }])}\n\`\`\``
    const out = parseOpsReviewsBlock(`${block1}\nsome text\n${block2}`)
    expect(out).toHaveLength(1)
    expect(out[0].opsActionId).toBe(`op_last`)
    expect(out[0].approve).toBe(false)
  })

  it(`does not include reason when it is empty or whitespace`, () => {
    const payload = [
      { opsActionId: `op_1`, approve: true, reason: `` },
      { opsActionId: `op_2`, approve: false, reason: `   ` },
    ]
    const out = parseOpsReviewsBlock(fenced(OpsReviewsBlockFence, payload))
    expect(out).toHaveLength(2)
    expect(out[0]).not.toHaveProperty(`reason`)
    expect(out[1]).not.toHaveProperty(`reason`)
  })

  it(`drops non-object array entries gracefully`, () => {
    const payload = [null, `string`, 42, { opsActionId: `op_ok`, approve: true }]
    const out = parseOpsReviewsBlock(fenced(OpsReviewsBlockFence, payload))
    expect(out).toHaveLength(1)
    expect(out[0].opsActionId).toBe(`op_ok`)
  })
})
