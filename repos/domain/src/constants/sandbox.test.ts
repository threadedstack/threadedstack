import { describe, it, expect } from 'vitest'
import { ESandboxRuntime, ERuntimeBrand } from '@TDM/types'
import {
  RuntimeProviderEnvMap,
  RuntimeSkillPathMap,
  SandboxPresets,
  SandboxRuntimeConfigs,
  SandboxRuntimeOptions,
} from './sandbox'
import { ProviderBrandDomains } from './providerDomains'

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

  it(`claude-code supports anthropic, amazon-bedrock, google-vertex, zai, openrouter, custom, ollama, ollamaCloud, deepseek`, () => {
    const brands = Object.keys(RuntimeProviderEnvMap[ESandboxRuntime.claudeCode]!)
    expect(brands).toContain(`anthropic`)
    expect(brands).toContain(`amazon-bedrock`)
    expect(brands).toContain(`google-vertex`)
    expect(brands).toContain(`zai`)
    expect(brands).toContain(`openrouter`)
    expect(brands).toContain(`custom`)
    expect(brands).toContain(`ollama`)
    expect(brands).toContain(`ollama:cloud`)
    expect(brands).toContain(`deepseek`)
  })

  it(`codex supports openai, openrouter, google, zai, ollamaCloud, deepseek`, () => {
    const brands = Object.keys(RuntimeProviderEnvMap[ESandboxRuntime.codex]!)
    expect(brands).toContain(`openai`)
    expect(brands).toContain(`openrouter`)
    expect(brands).toContain(`google`)
    expect(brands).toContain(`zai`)
    expect(brands).toContain(`ollama:cloud`)
    expect(brands).toContain(`deepseek`)
  })

  it(`antigravity supports google and google-vertex`, () => {
    const brands = Object.keys(RuntimeProviderEnvMap[ESandboxRuntime.antigravity]!)
    expect(brands).toContain(`google`)
    expect(brands).toContain(`google-vertex`)
  })

  it(`openclaw supports anthropic, openai, google, openrouter, ollamaCloud, custom, deepseek`, () => {
    const brands = Object.keys(RuntimeProviderEnvMap[ESandboxRuntime.openClaw]!)
    expect(brands).toContain(`anthropic`)
    expect(brands).toContain(`openai`)
    expect(brands).toContain(`google`)
    expect(brands).toContain(`openrouter`)
    expect(brands).toContain(`ollama:cloud`)
    expect(brands).toContain(`custom`)
    expect(brands).toContain(`deepseek`)
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

  it(`open-code supports anthropic, openai, openrouter, zai, ollamaCloud, deepseek`, () => {
    const brands = Object.keys(RuntimeProviderEnvMap[ESandboxRuntime.openCode]!)
    expect(brands).toContain(`anthropic`)
    expect(brands).toContain(`openai`)
    expect(brands).toContain(`openrouter`)
    expect(brands).toContain(`zai`)
    expect(brands).toContain(`ollama:cloud`)
    expect(brands).toContain(`deepseek`)
  })

  it(`pi-coding-agent supports anthropic, openai, deepseek, google, openrouter, zai, ollamaCloud, custom`, () => {
    const brands = Object.keys(RuntimeProviderEnvMap[ESandboxRuntime.piCodingAgent]!)
    expect(brands).toContain(`anthropic`)
    expect(brands).toContain(`openai`)
    expect(brands).toContain(`deepseek`)
    expect(brands).toContain(`google`)
    expect(brands).toContain(`openrouter`)
    expect(brands).toContain(`zai`)
    expect(brands).toContain(`ollama:cloud`)
    expect(brands).toContain(`custom`)
  })

  it(`claude-code deepseek uses ANTHROPIC_AUTH_TOKEN and Anthropic-compatible base URL`, () => {
    const entries =
      RuntimeProviderEnvMap[ESandboxRuntime.claudeCode]![ERuntimeBrand.deepseek]!
    const envVars = entries.map((e) => e.envVar)
    expect(envVars).toContain(`ANTHROPIC_AUTH_TOKEN`)
    expect(envVars).toContain(`ANTHROPIC_BASE_URL`)
    expect(envVars).not.toContain(`DEEPSEEK_API_KEY`)
    const baseUrlEntry = entries.find((e) => e.envVar === `ANTHROPIC_BASE_URL`)
    expect(baseUrlEntry!.source).toBe(`static`)
    expect((baseUrlEntry as any).staticValue).toBe(`https://api.deepseek.com/anthropic`)
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

  it(`includes piCodingAgent preset`, () => {
    expect(SandboxPresets[ESandboxRuntime.piCodingAgent]).toBeDefined()
    expect(SandboxPresets[ESandboxRuntime.piCodingAgent].name).toBe(`Pi Coding Agent`)
    expect(SandboxPresets[ESandboxRuntime.piCodingAgent].config.runtimeCommand).toBe(`pi`)
    expect(SandboxPresets[ESandboxRuntime.piCodingAgent].config.runtime).toBe(
      ESandboxRuntime.piCodingAgent
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

  it(`includes piCodingAgent config`, () => {
    expect(SandboxRuntimeConfigs[ESandboxRuntime.piCodingAgent]).toBeDefined()
    expect(SandboxRuntimeConfigs[ESandboxRuntime.piCodingAgent].runtimeCommand).toBe(`pi`)
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
    expect(script).toContain(`[model_providers.deepseek]`)
    expect(script).not.toMatch(/\[model_providers\.openai\]/)
    expect(script).not.toMatch(/\[model_providers\.ollama\]/)
    expect(script).not.toMatch(/\[model_providers\.lmstudio\]/)
  })

  it(`codex initScript has deepseek priority between ollama and google`, () => {
    const script = SandboxRuntimeConfigs[ESandboxRuntime.codex].initScript!
    const ollamaIdx = script.indexOf(`OLLAMA_API_KEY`)
    const deepseekIdx = script.indexOf(`DEEPSEEK_API_KEY`)
    const geminiIdx = script.indexOf(`GEMINI_API_KEY`)
    expect(ollamaIdx).toBeLessThan(deepseekIdx)
    expect(deepseekIdx).toBeLessThan(geminiIdx)
  })
})

describe(`SandboxRuntimeOptions`, () => {
  it(`has an entry for every ESandboxRuntime value`, () => {
    const runtimes = Object.values(ESandboxRuntime)
    for (const runtime of runtimes) {
      expect(
        SandboxRuntimeOptions.some((o) => o.value === runtime),
        `missing SandboxRuntimeOptions entry for ${runtime}`
      ).toBe(true)
    }
  })
})

describe(`RuntimeSkillPathMap`, () => {
  it(`has a non-null entry for every non-custom runtime`, () => {
    const runtimes = Object.values(ESandboxRuntime).filter(
      (r) => r !== ESandboxRuntime.custom
    )
    for (const runtime of runtimes) {
      const config = RuntimeSkillPathMap[runtime]
      expect(config, `${runtime} missing skill path config`).not.toBeNull()
      expect(config!.basePath).toBeTruthy()
      expect(config!.fileName).toBeTruthy()
      expect([`flat`, `nested`]).toContain(config!.fileLayout)
    }
  })

  it(`piCodingAgent skills stored at ~/.pi/agent/skills`, () => {
    const config = RuntimeSkillPathMap[ESandboxRuntime.piCodingAgent]!
    expect(config.basePath).toContain(`.pi/agent/skills`)
    expect(config.fileLayout).toBe(`nested`)
    expect(config.fileName).toBe(`SKILL.md`)
  })
})

describe(`ProviderBrandDomains`, () => {
  it(`deepseek maps to api.deepseek.com`, () => {
    expect(ProviderBrandDomains.deepseek).toBeDefined()
    expect(ProviderBrandDomains.deepseek).toContain(`api.deepseek.com`)
  })
})
