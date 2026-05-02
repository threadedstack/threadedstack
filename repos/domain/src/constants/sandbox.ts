import type {
  TSandboxRuntimeId,
  TKubeSandboxConfig,
  TRuntimeProviderEnvMap,
} from '@TDM/types'

import { EImagePullPolicy, ESandboxRuntime, ERuntimeBrand } from '@TDM/types'

export const SBImagePullPolicyOptions = [
  { value: EImagePullPolicy.Never, label: EImagePullPolicy.Never },
  { value: EImagePullPolicy.Always, label: EImagePullPolicy.Always },
  { value: EImagePullPolicy.IfNotPresent, label: EImagePullPolicy.IfNotPresent },
]

export const SBRuntimeOptions = [
  { value: `node`, label: `Node.js` },
  { value: `python`, label: `Python` },
]

export const SandboxRuntimeOptions = [
  { value: ESandboxRuntime.claudeCode, label: `Claude Code` },
  { value: ESandboxRuntime.codex, label: `Codex` },
  { value: ESandboxRuntime.openCode, label: `OpenCode` },
  { value: ESandboxRuntime.geminiCli, label: `Gemini CLI` },
  { value: ESandboxRuntime.custom, label: `Custom` },
]

/**
 * Maps each built-in runtime to its runtime command and init script.
 * - runtimeCommand: what `tsa run` executes after SSH connect
 * - initScript: default setup script for this runtime
 * - command/args: optional container overrides (built-in presets use the Dockerfile ENTRYPOINT)
 */
export const SandboxRuntimeConfigs: Record<
  TSandboxRuntimeId,
  {
    command?: string[]
    args?: string[]
    runtimeCommand?: string
    initScript?: string
  }
> = {
  [ESandboxRuntime.claudeCode]: {
    runtimeCommand: `claude`,
    initScript: `echo "Claude Code sandbox ready"`,
  },
  [ESandboxRuntime.codex]: {
    runtimeCommand: `codex`,
    initScript: [
      `mkdir -p ~/.codex`,
      `# Default provider: later assignments win — priority: openai > openrouter > zai > google > ollama`,
      `DP=""`,
      `[ -n "$OLLAMA_API_KEY" ] && DP="ollama-cloud"`,
      `[ -n "$GEMINI_API_KEY" ] && DP="google-ai"`,
      `[ -n "$Z_AI_API_KEY" ] && DP="zai"`,
      `[ -n "$OPENROUTER_API_KEY" ] && DP="openrouter"`,
      `[ -n "$OPENAI_API_KEY" ] && DP="openai-direct"`,
      `{`,
      `[ -n "$DP" ] && echo "model_provider = \\"$DP\\""`,
      `cat << 'TDSK_CODEX_PROVIDERS'`,
      ``,
      `[model_providers.openai-direct]`,
      `name = "OpenAI"`,
      `base_url = "https://api.openai.com/v1"`,
      `env_key = "OPENAI_API_KEY"`,
      ``,
      `[model_providers.openrouter]`,
      `name = "OpenRouter"`,
      `base_url = "https://openrouter.ai/api/v1"`,
      `env_key = "OPENROUTER_API_KEY"`,
      ``,
      `[model_providers.zai]`,
      `name = "Z.AI GLM Coding Plan"`,
      `base_url = "https://api.z.ai/api/coding/paas/v4"`,
      `env_key = "Z_AI_API_KEY"`,
      ``,
      `[model_providers.google-ai]`,
      `name = "Google Gemini"`,
      `base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"`,
      `env_key = "GEMINI_API_KEY"`,
      ``,
      `[model_providers.ollama-cloud]`,
      `name = "Ollama Cloud"`,
      `base_url = "https://ollama.com/v1"`,
      `env_key = "OLLAMA_API_KEY"`,
      `TDSK_CODEX_PROVIDERS`,
      `} > ~/.codex/config.toml`,
      `echo "Codex sandbox ready"`,
    ].join(`\n`),
  },
  [ESandboxRuntime.openCode]: {
    runtimeCommand: `opencode`,
    initScript: `echo "OpenCode sandbox ready"`,
  },
  [ESandboxRuntime.geminiCli]: {
    runtimeCommand: `gemini`,
    initScript: `echo "Gemini CLI sandbox ready"`,
  },
  [ESandboxRuntime.custom]: {},
}

export const DefaultWorkdir = `/workspace`

const DefaultResources = {
  limits: { cpu: `2`, memory: `4Gi` },
  requests: { cpu: `500m`, memory: `1Gi` },
}

/**
 * Pre-configured sandbox configs seeded per org on creation.
 * Each creates a real sandbox row that is immediately startable.
 */
export const SandboxPresets: Record<
  TSandboxRuntimeId,
  {
    name: string
    description: string
    config: Partial<TKubeSandboxConfig>
  }
> = {
  [ESandboxRuntime.claudeCode]: {
    name: `Claude Code`,
    description: `Anthropic Claude Code AI assistant`,
    config: {
      sshEnabled: true,
      idleTimeoutMinutes: 30,
      resources: DefaultResources,
      runtime: ESandboxRuntime.claudeCode,
      runtimeCommand: SandboxRuntimeConfigs[ESandboxRuntime.claudeCode].runtimeCommand,
      initScript: SandboxRuntimeConfigs[ESandboxRuntime.claudeCode].initScript,
    },
  },
  [ESandboxRuntime.codex]: {
    name: `Codex`,
    description: `OpenAI Codex AI coding assistant`,
    config: {
      sshEnabled: true,
      idleTimeoutMinutes: 30,
      resources: DefaultResources,
      runtime: ESandboxRuntime.codex,
      runtimeCommand: SandboxRuntimeConfigs[ESandboxRuntime.codex].runtimeCommand,
      initScript: SandboxRuntimeConfigs[ESandboxRuntime.codex].initScript,
    },
  },
  [ESandboxRuntime.openCode]: {
    name: `OpenCode`,
    description: `OpenCode AI coding assistant`,
    config: {
      sshEnabled: true,
      idleTimeoutMinutes: 30,
      resources: DefaultResources,
      runtime: ESandboxRuntime.openCode,
      runtimeCommand: SandboxRuntimeConfigs[ESandboxRuntime.openCode].runtimeCommand,
      initScript: SandboxRuntimeConfigs[ESandboxRuntime.openCode].initScript,
    },
  },
  [ESandboxRuntime.geminiCli]: {
    name: `Gemini CLI`,
    description: `Google Gemini CLI AI coding assistant`,
    config: {
      sshEnabled: true,
      idleTimeoutMinutes: 30,
      resources: DefaultResources,
      runtime: ESandboxRuntime.geminiCli,
      runtimeCommand: SandboxRuntimeConfigs[ESandboxRuntime.geminiCli].runtimeCommand,
      initScript: SandboxRuntimeConfigs[ESandboxRuntime.geminiCli].initScript,
    },
  },
  [ESandboxRuntime.custom]: {
    name: `Base`,
    description: `Base sandbox with SSH — bring your own runtime`,
    config: {
      sshEnabled: true,
      idleTimeoutMinutes: 30,
      resources: DefaultResources,
      runtime: ESandboxRuntime.custom,
    },
  },
}

export const RuntimeProviderEnvMap: TRuntimeProviderEnvMap = {
  [ESandboxRuntime.claudeCode]: {
    [ERuntimeBrand.anthropic]: [
      { envVar: `ANTHROPIC_API_KEY`, source: `secret`, required: true },
    ],
    [ERuntimeBrand.amazonBedrock]: [
      {
        envVar: `CLAUDE_CODE_USE_BEDROCK`,
        source: `static`,
        staticValue: `1`,
        injection: `direct`,
      },
      {
        envVar: `AWS_REGION`,
        source: `option`,
        optionKey: `region`,
        injection: `direct`,
        required: true,
      },
      {
        envVar: `AWS_ACCESS_KEY_ID`,
        source: `option`,
        optionKey: `accessKeyId`,
        injection: `direct`,
        required: true,
      },
      {
        envVar: `AWS_SECRET_ACCESS_KEY`,
        source: `secret`,
        injection: `direct`,
        required: true,
      },
      {
        envVar: `AWS_SESSION_TOKEN`,
        source: `option`,
        optionKey: `sessionToken`,
        injection: `direct`,
      },
    ],
    [ERuntimeBrand.amazonBedrockBearer]: [
      {
        envVar: `CLAUDE_CODE_USE_BEDROCK`,
        source: `static`,
        staticValue: `1`,
        injection: `direct`,
      },
      {
        envVar: `AWS_REGION`,
        source: `option`,
        optionKey: `region`,
        injection: `direct`,
        required: true,
      },
      { envVar: `AWS_BEARER_TOKEN_BEDROCK`, source: `secret`, required: true },
    ],
    [ERuntimeBrand.googleVertex]: [
      {
        envVar: `CLAUDE_CODE_USE_VERTEX`,
        source: `static`,
        staticValue: `1`,
        injection: `direct`,
      },
      {
        envVar: `CLOUD_ML_REGION`,
        source: `option`,
        optionKey: `region`,
        injection: `direct`,
        defaultValue: `global`,
      },
      {
        envVar: `ANTHROPIC_VERTEX_PROJECT_ID`,
        source: `option`,
        optionKey: `projectId`,
        injection: `direct`,
        required: true,
      },
      {
        envVar: `GOOGLE_APPLICATION_CREDENTIALS`,
        source: `secret`,
        injection: `file`,
        filePath: `/tmp/gcloud-sa.json`,
        required: true,
      },
    ],
    [ERuntimeBrand.zai]: [
      { envVar: `ANTHROPIC_AUTH_TOKEN`, source: `secret`, required: true },
      {
        envVar: `ANTHROPIC_BASE_URL`,
        source: `static`,
        staticValue: `https://api.z.ai/api/anthropic`,
        injection: `direct`,
      },
      {
        envVar: `API_TIMEOUT_MS`,
        source: `static`,
        staticValue: `3000000`,
        injection: `direct`,
      },
      {
        envVar: `ANTHROPIC_DEFAULT_HAIKU_MODEL`,
        source: `option`,
        optionKey: `haikuModel`,
        injection: `direct`,
        defaultValue: `glm-4.5-air`,
      },
      {
        envVar: `ANTHROPIC_DEFAULT_SONNET_MODEL`,
        source: `option`,
        optionKey: `sonnetModel`,
        injection: `direct`,
        defaultValue: `glm-4.7`,
      },
      {
        envVar: `ANTHROPIC_DEFAULT_OPUS_MODEL`,
        source: `option`,
        optionKey: `opusModel`,
        injection: `direct`,
        defaultValue: `glm-4.7`,
      },
    ],
    [ERuntimeBrand.openrouter]: [
      { envVar: `ANTHROPIC_AUTH_TOKEN`, source: `secret`, required: true },
      {
        envVar: `ANTHROPIC_API_KEY`,
        source: `static`,
        staticValue: ``,
        injection: `direct`,
      },
      {
        envVar: `ANTHROPIC_BASE_URL`,
        source: `static`,
        staticValue: `https://openrouter.ai/api`,
        injection: `direct`,
      },
      {
        envVar: `ANTHROPIC_MODEL`,
        source: `option`,
        optionKey: `model`,
        injection: `direct`,
      },
    ],
    [ERuntimeBrand.custom]: [
      { envVar: `ANTHROPIC_AUTH_TOKEN`, source: `secret`, required: true },
      {
        envVar: `ANTHROPIC_BASE_URL`,
        source: `option`,
        optionKey: `baseUrl`,
        injection: `direct`,
        required: true,
      },
      {
        envVar: `ANTHROPIC_MODEL`,
        source: `option`,
        optionKey: `model`,
        injection: `direct`,
      },
    ],
    [ERuntimeBrand.ollama]: [
      {
        envVar: `ANTHROPIC_AUTH_TOKEN`,
        source: `static`,
        staticValue: `ollama`,
        injection: `direct`,
      },
      {
        envVar: `ANTHROPIC_API_KEY`,
        source: `static`,
        staticValue: ``,
        injection: `direct`,
      },
      {
        envVar: `ANTHROPIC_BASE_URL`,
        source: `option`,
        optionKey: `baseUrl`,
        injection: `direct`,
        required: true,
        defaultValue: `http://localhost:11434`,
      },
      {
        envVar: `ANTHROPIC_MODEL`,
        source: `option`,
        optionKey: `model`,
        injection: `direct`,
      },
    ],
    [ERuntimeBrand.ollamaCloud]: [
      { envVar: `ANTHROPIC_AUTH_TOKEN`, source: `secret`, required: true },
      {
        envVar: `ANTHROPIC_API_KEY`,
        source: `static`,
        staticValue: ``,
        injection: `direct`,
      },
      {
        envVar: `ANTHROPIC_BASE_URL`,
        source: `static`,
        staticValue: `https://ollama.com`,
        injection: `direct`,
      },
      {
        envVar: `ANTHROPIC_MODEL`,
        source: `option`,
        optionKey: `model`,
        injection: `direct`,
      },
    ],
  },
  [ESandboxRuntime.codex]: {
    [ERuntimeBrand.openai]: [
      { envVar: `OPENAI_API_KEY`, source: `secret`, required: true },
    ],
    [ERuntimeBrand.openrouter]: [
      { envVar: `OPENROUTER_API_KEY`, source: `secret`, required: true },
    ],
    [ERuntimeBrand.google]: [
      { envVar: `GEMINI_API_KEY`, source: `secret`, required: true },
    ],
    [ERuntimeBrand.zai]: [{ envVar: `Z_AI_API_KEY`, source: `secret`, required: true }],
    [ERuntimeBrand.ollamaCloud]: [
      { envVar: `OLLAMA_API_KEY`, source: `secret`, required: true },
    ],
  },
  [ESandboxRuntime.openCode]: {
    [ERuntimeBrand.anthropic]: [
      { envVar: `ANTHROPIC_API_KEY`, source: `secret`, required: true },
    ],
    [ERuntimeBrand.openai]: [
      { envVar: `OPENAI_API_KEY`, source: `secret`, required: true },
    ],
    [ERuntimeBrand.openrouter]: [
      { envVar: `OPENROUTER_API_KEY`, source: `secret`, required: true },
    ],
    [ERuntimeBrand.zai]: [{ envVar: `ZHIPU_API_KEY`, source: `secret`, required: true }],
    [ERuntimeBrand.ollamaCloud]: [
      { envVar: `OLLAMA_API_KEY`, source: `secret`, required: true },
    ],
  },
  [ESandboxRuntime.geminiCli]: {
    [ERuntimeBrand.google]: [
      { envVar: `GOOGLE_API_KEY`, source: `secret`, required: true },
    ],
    [ERuntimeBrand.googleVertex]: [
      { envVar: `GOOGLE_API_KEY`, source: `secret`, injection: `direct`, required: true },
      {
        envVar: `GOOGLE_GENAI_USE_VERTEXAI`,
        source: `static`,
        staticValue: `true`,
        injection: `direct`,
      },
      {
        envVar: `GOOGLE_APPLICATION_CREDENTIALS`,
        source: `secret`,
        injection: `file`,
        filePath: `/tmp/gcloud-sa.json`,
      },
      {
        envVar: `GOOGLE_CLOUD_PROJECT`,
        source: `option`,
        optionKey: `projectId`,
        injection: `direct`,
      },
      {
        envVar: `GOOGLE_CLOUD_REGION`,
        source: `option`,
        optionKey: `region`,
        injection: `direct`,
      },
    ],
  },
  [ESandboxRuntime.custom]: {},
}
