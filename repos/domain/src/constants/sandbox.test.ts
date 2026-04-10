import { describe, it, expect } from 'vitest'
import { ESandboxRuntime } from '@TDM/types'
import { RuntimeProviderEnvMap, SandboxPresets, SandboxRuntimeConfigs } from './sandbox'

describe(`RuntimeProviderEnvMap`, () => {
  it(`has mappings for every non-custom runtime`, () => {
    const runtimes = Object.values(ESandboxRuntime).filter(
      (r) => r !== ESandboxRuntime.custom
    )
    for (const runtime of runtimes) {
      expect(RuntimeProviderEnvMap[runtime]).toBeDefined()
      expect(Object.keys(RuntimeProviderEnvMap[runtime]!).length).toBeGreaterThan(0)
    }
  })

  it(`claude-code supports anthropic, amazon-bedrock, google-vertex, zai, openrouter, custom, ollama`, () => {
    const brands = Object.keys(RuntimeProviderEnvMap[ESandboxRuntime.claudeCode]!)
    expect(brands).toContain(`anthropic`)
    expect(brands).toContain(`amazon-bedrock`)
    expect(brands).toContain(`google-vertex`)
    expect(brands).toContain(`zai`)
    expect(brands).toContain(`openrouter`)
    expect(brands).toContain(`custom`)
    expect(brands).toContain(`ollama`)
  })

  it(`codex supports openai, openrouter, google`, () => {
    const brands = Object.keys(RuntimeProviderEnvMap[ESandboxRuntime.codex]!)
    expect(brands).toContain(`openai`)
    expect(brands).toContain(`openrouter`)
    expect(brands).toContain(`google`)
  })

  it(`gemini-cli supports google and google-vertex`, () => {
    const brands = Object.keys(RuntimeProviderEnvMap[ESandboxRuntime.geminiCli]!)
    expect(brands).toContain(`google`)
    expect(brands).toContain(`google-vertex`)
  })

  it(`every required entry with source=secret has injection specified or defaults to mitm`, () => {
    for (const [, brands] of Object.entries(RuntimeProviderEnvMap)) {
      for (const [, entries] of Object.entries(brands)) {
        for (const entry of entries as any[]) {
          if (entry.source === `secret` && entry.required) {
            expect(entry.injection ?? `mitm`).toMatch(/^(mitm|direct|file)$/)
          }
        }
      }
    }
  })

  it(`every entry has a non-empty envVar string`, () => {
    for (const [runtime, brands] of Object.entries(RuntimeProviderEnvMap)) {
      for (const [brand, entries] of Object.entries(brands)) {
        for (const entry of entries as any[]) {
          expect(
            entry.envVar,
            `${runtime}/${brand} has entry without envVar`
          ).toBeTruthy()
          expect(typeof entry.envVar).toBe(`string`)
        }
      }
    }
  })

  it(`every entry has a valid source (secret, static, or option)`, () => {
    for (const [runtime, brands] of Object.entries(RuntimeProviderEnvMap)) {
      for (const [brand, entries] of Object.entries(brands)) {
        for (const entry of entries as any[]) {
          expect([`secret`, `static`, `option`]).toContain(entry.source)
        }
      }
    }
  })

  it(`static source entries have a staticValue defined`, () => {
    for (const [runtime, brands] of Object.entries(RuntimeProviderEnvMap)) {
      for (const [brand, entries] of Object.entries(brands)) {
        for (const entry of entries as any[]) {
          if (entry.source === `static`) {
            expect(
              entry.staticValue !== undefined,
              `${runtime}/${brand}/${entry.envVar} static without staticValue`
            ).toBe(true)
          }
        }
      }
    }
  })

  it(`option source entries have an optionKey defined`, () => {
    for (const [runtime, brands] of Object.entries(RuntimeProviderEnvMap)) {
      for (const [brand, entries] of Object.entries(brands)) {
        for (const entry of entries as any[]) {
          if (entry.source === `option`) {
            expect(
              entry.optionKey,
              `${runtime}/${brand}/${entry.envVar} option without optionKey`
            ).toBeTruthy()
          }
        }
      }
    }
  })

  it(`file injection entries have a filePath defined`, () => {
    for (const [runtime, brands] of Object.entries(RuntimeProviderEnvMap)) {
      for (const [brand, entries] of Object.entries(brands)) {
        for (const entry of entries as any[]) {
          if (entry.injection === `file`) {
            expect(
              entry.filePath,
              `${runtime}/${brand}/${entry.envVar} file injection without filePath`
            ).toBeTruthy()
          }
        }
      }
    }
  })

  it(`no duplicate envVars within any runtime/brand combination`, () => {
    for (const [runtime, brands] of Object.entries(RuntimeProviderEnvMap)) {
      for (const [brand, entries] of Object.entries(brands)) {
        const envVars = (entries as any[]).map((e) => e.envVar)
        const unique = new Set(envVars)
        expect(
          envVars.length,
          `${runtime}/${brand} has duplicate envVars: ${envVars.filter((v, i) => envVars.indexOf(v) !== i)}`
        ).toBe(unique.size)
      }
    }
  })

  it(`each non-custom runtime+brand has at least one required entry`, () => {
    const runtimes = Object.values(ESandboxRuntime).filter(
      (r) => r !== ESandboxRuntime.custom
    )
    for (const runtime of runtimes) {
      const brands = RuntimeProviderEnvMap[runtime]
      if (!brands) continue
      for (const [brand, entries] of Object.entries(brands)) {
        const hasRequired = (entries as any[]).some((e) => e.required)
        expect(hasRequired, `${runtime}/${brand} has no required entries`).toBe(true)
      }
    }
  })

  it(`open-code supports anthropic, openai, openrouter`, () => {
    const brands = Object.keys(RuntimeProviderEnvMap[ESandboxRuntime.openCode]!)
    expect(brands).toContain(`anthropic`)
    expect(brands).toContain(`openai`)
    expect(brands).toContain(`openrouter`)
  })
})

describe(`SandboxPresets`, () => {
  it(`includes geminiCli preset`, () => {
    expect(SandboxPresets[ESandboxRuntime.geminiCli]).toBeDefined()
    expect(SandboxPresets[ESandboxRuntime.geminiCli].name).toBe(`Gemini CLI`)
    expect(SandboxPresets[ESandboxRuntime.geminiCli].config.runtimeCommand).toBe(`gemini`)
    expect(SandboxPresets[ESandboxRuntime.geminiCli].config.runtime).toBe(
      ESandboxRuntime.geminiCli
    )
  })
})

describe(`SandboxRuntimeConfigs`, () => {
  it(`includes geminiCli config`, () => {
    expect(SandboxRuntimeConfigs[ESandboxRuntime.geminiCli]).toBeDefined()
    expect(SandboxRuntimeConfigs[ESandboxRuntime.geminiCli].runtimeCommand).toBe(`gemini`)
  })
})
