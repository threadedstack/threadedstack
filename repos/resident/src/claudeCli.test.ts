import { describe, it, expect } from 'vitest'

import { buildTurnArgs, parseClaudeJsonOutput } from './claudeCli'

describe(`buildTurnArgs`, () => {
  it(`builds the first-turn invocation (no resume)`, () => {
    expect(buildTurnArgs(`do the thing`)).toEqual([
      `-p`,
      `--output-format`,
      `json`,
      `--dangerously-skip-permissions`,
      `do the thing`,
    ])
  })

  it(`builds the resumed invocation with the session id`, () => {
    expect(buildTurnArgs(`next step`, `sess-42`)).toEqual([
      `-p`,
      `--resume`,
      `sess-42`,
      `--output-format`,
      `json`,
      `--dangerously-skip-permissions`,
      `next step`,
    ])
  })

  it(`passes the prompt as a positional argv entry (no shell escaping needed)`, () => {
    const nasty = `it's got 'quotes' and $VARS and \`backticks\``
    const args = buildTurnArgs(nasty)
    expect(args[args.length - 1]).toBe(nasty)
  })
})

describe(`parseClaudeJsonOutput`, () => {
  it(`parses the JSON envelope`, () => {
    const out = parseClaudeJsonOutput(
      JSON.stringify({
        type: `result`,
        result: `hello`,
        session_id: `s1`,
        is_error: false,
      })
    )
    expect(out).toEqual({ resultText: `hello`, sessionId: `s1`, isError: false })
  })

  it(`falls back to the last non-empty line when there is leading noise`, () => {
    const envelope = JSON.stringify({ result: `tail`, session_id: `s2` })
    const out = parseClaudeJsonOutput(`some warning\nanother line\n${envelope}\n`)
    expect(out.resultText).toBe(`tail`)
    expect(out.sessionId).toBe(`s2`)
  })

  it(`degrades to raw text when nothing parses`, () => {
    const out = parseClaudeJsonOutput(`plain output, no json`)
    expect(out.resultText).toBe(`plain output, no json`)
    expect(out.sessionId).toBeUndefined()
  })

  it(`surfaces is_error`, () => {
    const out = parseClaudeJsonOutput(
      JSON.stringify({ result: `boom`, session_id: `s3`, is_error: true })
    )
    expect(out.isError).toBe(true)
  })

  it(`handles empty output`, () => {
    expect(parseClaudeJsonOutput(``)).toEqual({ resultText: `` })
  })
})
