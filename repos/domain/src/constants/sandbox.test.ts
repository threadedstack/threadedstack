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

  it(`claude-code supports anthropic, amazon-bedrock, google-vertex, zai, openrouter, custom, ollama, ollamaCloud`, () => {
    const brands = Object.keys(RuntimeProviderEnvMap[ESandboxRuntime.claudeCode]!)
    expect(brands).toContain(`anthropic`)
    expect(brands).toContain(`amazon-bedrock`)
    expect(brands).toContain(`google-vertex`)
    expect(brands).toContain(`zai`)
    expect(brands).toContain(`openrouter`)
    expect(brands).toContain(`custom`)
    expect(brands).toContain(`ollama`)
    expect(brands).toContain(`ollama:cloud`)
  })

  it(`codex supports openai, openrouter, google, zai, ollamaCloud`, () => {
    const brands = Object.keys(RuntimeProviderEnvMap[ESandboxRuntime.codex]!)
    expect(brands).toContain(`openai`)
    expect(brands).toContain(`openrouter`)
    expect(brands).toContain(`google`)
    expect(brands).toContain(`zai`)
    expect(brands).toContain(`ollama:cloud`)
  })

  it(`antigravity supports google and google-vertex`, () => {
    const brands = Object.keys(RuntimeProviderEnvMap[ESandboxRuntime.antigravity]!)
    expect(brands).toContain(`google`)
    expect(brands).toContain(`google-vertex`)
  })

  it(`openclaw supports anthropic, openai, google, openrouter, ollamaCloud, custom`, () => {
    const brands = Object.keys(RuntimeProviderEnvMap[ESandboxRuntime.openClaw]!)
    expect(brands).toContain(`anthropic`)
    expect(brands).toContain(`openai`)
    expect(brands).toContain(`google`)
    expect(brands).toContain(`openrouter`)
    expect(brands).toContain(`ollama:cloud`)
    expect(brands).toContain(`custom`)
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

  it(`open-code supports anthropic, openai, openrouter, zai, ollamaCloud`, () => {
    const brands = Object.keys(RuntimeProviderEnvMap[ESandboxRuntime.openCode]!)
    expect(brands).toContain(`anthropic`)
    expect(brands).toContain(`openai`)
    expect(brands).toContain(`openrouter`)
    expect(brands).toContain(`zai`)
    expect(brands).toContain(`ollama:cloud`)
  })
})

describe(`SandboxPresets`, () => {
  it(`includes antigravity preset`, () => {
    expect(SandboxPresets[ESandboxRuntime.antigravity]).toBeDefined()
    expect(SandboxPresets[ESandboxRuntime.antigravity].name).toBe(`Antigravity`)
    expect(SandboxPresets[ESandboxRuntime.antigravity].config.runtimeCommand).toBe(`agy`)
    expect(SandboxPresets[ESandboxRuntime.antigravity].config.runtime).toBe(
      ESandboxRuntime.antigravity
    )
  })

  it(`includes openClaw preset`, () => {
    expect(SandboxPresets[ESandboxRuntime.openClaw]).toBeDefined()
    expect(SandboxPresets[ESandboxRuntime.openClaw].name).toBe(`OpenClaw`)
    expect(SandboxPresets[ESandboxRuntime.openClaw].config.runtimeCommand).toBe(
      `openclaw`
    )
    expect(SandboxPresets[ESandboxRuntime.openClaw].config.runtime).toBe(
      ESandboxRuntime.openClaw
    )
  })
})

describe(`SandboxRuntimeConfigs`, () => {
  it(`includes antigravity config`, () => {
    expect(SandboxRuntimeConfigs[ESandboxRuntime.antigravity]).toBeDefined()
    expect(SandboxRuntimeConfigs[ESandboxRuntime.antigravity].runtimeCommand).toBe(`agy`)
  })

  it(`includes openClaw config`, () => {
    expect(SandboxRuntimeConfigs[ESandboxRuntime.openClaw]).toBeDefined()
    expect(SandboxRuntimeConfigs[ESandboxRuntime.openClaw].runtimeCommand).toBe(
      `openclaw`
    )
  })

  it(`codex initScript generates config.toml with custom providers`, () => {
    const script = SandboxRuntimeConfigs[ESandboxRuntime.codex].initScript!
    expect(script).toContain(`mkdir -p ~/.codex`)
    expect(script).toContain(`config.toml`)
    expect(script).toContain(`[model_providers.openai-direct]`)
    expect(script).toContain(`[model_providers.openrouter]`)
    expect(script).toContain(`[model_providers.zai]`)
    expect(script).toContain(`[model_providers.google-ai]`)
    expect(script).toContain(`[model_providers.ollama-cloud]`)
    expect(script).not.toMatch(/\[model_providers\.openai\]/)
    expect(script).not.toMatch(/\[model_providers\.ollama\]/)
    expect(script).not.toMatch(/\[model_providers\.lmstudio\]/)
  })
})
