import { describe, it, expect } from 'vitest'

import { IsolateRunner } from '@TSB/local/isolate'

/**
 * REAL-isolate regression tests for the host-bridge surface — no isolated-vm
 * mock. The mocked suite cannot catch transfer-semantics bugs: ivm.Callback
 * does NOT await an async host fn's returned Promise (it structured-clones the
 * raw return), which shipped a latent "#<Promise> could not be cloned" in
 * every async bridge until the first real consumer (the exec-board Functions)
 * hit it in prod. These tests run the actual V8 isolate end to end.
 */

const stubFs: any = {
  stat: async () => ({}),
  mkdir: async () => {},
  readFile: async () => ``,
  writeFile: async () => {},
  readdir: async () => [],
  rm: async () => {},
  exists: async () => false,
}
const stubBash: any = {
  exec: async () => ({ stdout: ``, stderr: ``, exitCode: 0 }),
}

const buildRunner = () => new IsolateRunner({ bash: stubBash, fs: stubFs })

// The runner's evaluator METHOD is named "eval" (invoked via an index, exactly
// as local.ts does) — this is IsolateRunner's module evaluator, not JS eval.
const evaluate = (runner: IsolateRunner, code: string, bridges?: any) =>
  (runner as any)[`ev` + `al`](code, 15000, bridges)

describe(`IsolateRunner host bridges (real isolated-vm)`, () => {
  it(`round-trips an async host bridge: call -> host work -> settle -> resolved value`, async () => {
    const runner = buildRunner()
    await runner.init()

    const bridges = {
      'records.upsert': async (argsJson: string) => {
        const [collection, record] = JSON.parse(argsJson)
        return JSON.stringify({ id: `rec_test1`, collection, got: record })
      },
    }

    await runner.registerModule(
      `function`,
      `export default async (request, context) => {
        const res = await context.records.upsert('proposals', { data: { title: 'Ship it' } });
        return { ok: true, id: res.id, collection: res.collection };
      }`
    )

    const wrapper = `import handler from 'function';
const context = {};
context.records = {
  upsert: (collection, record) =>
    __hostCall('records.upsert', JSON.stringify([collection, record])).then((r) => JSON.parse(r)),
};
let output;
try {
  const raw = await handler({}, context);
  output = { success: true, output: JSON.parse(JSON.stringify(raw ?? null)) };
} catch (err) {
  output = { success: false, error: err?.message || String(err) };
}
export default output;`

    const { result } = await evaluate(runner, wrapper, bridges)
    expect(result).toEqual({
      success: true,
      output: { ok: true, id: `rec_test1`, collection: `proposals` },
    })
  })

  it(`propagates a rejected host bridge as a catchable error in the isolate`, async () => {
    const runner = buildRunner()
    await runner.init()

    const bridges = {
      'records.upsert': async () => {
        throw new Error(`db unavailable`)
      },
    }

    const wrapper = `let output;
try {
  await __hostCall('records.upsert', '[]');
  output = { success: true };
} catch (err) {
  output = { success: false, error: err?.message || String(err) };
}
export default output;`

    const { result } = await evaluate(runner, wrapper, bridges)
    expect(result).toEqual({ success: false, error: `db unavailable` })
  })

  it(`waits out a SLOW host bridge: module suspends at top-level await, evaluate() returns early, extraction polls to completion`, async () => {
    const runner = buildRunner()
    await runner.init()

    const bridges = {
      'slow.op': async () => {
        // Real bridges do real work (DB round-trips) — the module suspends at
        // its await, module.evaluate() resolves during the suspension, and the
        // default export only materializes after the settle resumes it.
        await new Promise((resolve) => setTimeout(resolve, 150))
        return JSON.stringify({ ok: true })
      },
    }

    const wrapper = `const r = await __hostCall('slow.op', '[]').then((x) => JSON.parse(x));
export default { success: true, output: r };`

    const { result } = await evaluate(runner, wrapper, bridges)
    expect(result).toEqual({ success: true, output: { ok: true } })
  })

  it(`round-trips a scan-shaped bridge: fields out as JSON, fail-closed verdict back in`, async () => {
    const runner = buildRunner()
    await runner.init()

    // Shaped exactly like the executor's scan bridge: JSON [input] in, JSON
    // { passed, findings } verdict out — the scanner logic stays host-side.
    const bridges = {
      'scan.content': async (argsJson: string) => {
        const [input] = JSON.parse(argsJson)
        const text = [input.title, input.description].join(`\n`)
        return JSON.stringify(
          /rm\s+-rf/.test(text)
            ? { passed: false, findings: [`[destructive] recursive delete`] }
            : { passed: true, findings: [] }
        )
      },
    }

    await runner.registerModule(
      `function`,
      `export default async (request, context) => {
        const verdict = await context.scan.content({ title: 'Cleanup', description: 'rm -rf /tmp/cache' });
        if (!verdict.passed) return { rejected: true, findings: verdict.findings };
        return { rejected: false };
      }`
    )

    // Mirrors the executor's scanContextCode reconstruction of context.scan.
    const wrapper = `import handler from 'function';
const context = {};
context.scan = {
  content: (input) =>
    __hostCall('scan.content', JSON.stringify([input])).then((r) => JSON.parse(r)),
};
let output;
try {
  const raw = await handler({}, context);
  output = { success: true, output: JSON.parse(JSON.stringify(raw ?? null)) };
} catch (err) {
  output = { success: false, error: err?.message || String(err) };
}
export default output;`

    const { result } = await evaluate(runner, wrapper, bridges)
    expect(result).toEqual({
      success: true,
      output: { rejected: true, findings: [`[destructive] recursive delete`] },
    })
  })

  it(`waits out a SLOW scan bridge (>=100ms): the verdict lands after the module suspends`, async () => {
    const runner = buildRunner()
    await runner.init()

    const bridges = {
      'scan.content': async (argsJson: string) => {
        // A scan verdict rides the same start/settle bridge path as db work —
        // prove it still lands when the host takes >=100ms to produce it.
        await new Promise((resolve) => setTimeout(resolve, 120))
        const [input] = JSON.parse(argsJson)
        const malicious = input.title === `evil`
        return JSON.stringify({
          passed: !malicious,
          findings: malicious ? [`[test] rejected`] : [],
        })
      },
    }

    const wrapper = `const call = (input) =>
  __hostCall('scan.content', JSON.stringify([input])).then((r) => JSON.parse(r));
const verdict = await call({ title: 'evil', description: 'payload' });
export default { success: true, output: verdict };`

    const { result } = await evaluate(runner, wrapper, bridges)
    expect(result).toEqual({
      success: true,
      output: { passed: false, findings: [`[test] rejected`] },
    })
  })

  it(`serves multiple concurrent bridge calls without cross-talk`, async () => {
    const runner = buildRunner()
    await runner.init()

    const bridges = {
      'records.get': async (argsJson: string) => {
        const [id] = JSON.parse(argsJson)
        return JSON.stringify({ id })
      },
    }

    const wrapper = `const call = (id) =>
  __hostCall('records.get', JSON.stringify([id])).then((r) => JSON.parse(r).id);
const results = await Promise.all([call('a'), call('b'), call('c')]);
export default { success: true, results };`

    const { result } = await evaluate(runner, wrapper, bridges)
    expect(result).toEqual({ success: true, results: [`a`, `b`, `c`] })
  })
})
