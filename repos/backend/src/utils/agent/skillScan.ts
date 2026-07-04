import type { TScanResult, TSkillAuthorInput } from '@tdsk/domain'

import { EAgentTool } from '@tdsk/domain'

/**
 * Deterministic security scan for self-authored skill proposals (P3b).
 *
 * Skills feed straight into the agent prompt and can activate gated tools, so a
 * poisoned or self-authored skill is a direct prompt-injection / privilege-
 * escalation vector. This scan is the HARD GATE in the promotion pipeline: it
 * runs at authoring time and AGAIN before promotion, and is FAIL-CLOSED — any
 * finding blocks the proposal regardless of the auditor's semantic verdict.
 *
 * It is intentionally conservative (favouring false-positives over letting a
 * dangerous skill through); a rejected agent can rephrase and re-propose.
 */

type TScanRule = { category: string; label: string; pattern: RegExp }

/**
 * Text pattern registry. Each pattern has NO `g` flag so `.test` is stateless.
 * Scanned against the combined name + description + instructions text.
 */
const TextScanRules: TScanRule[] = [
  // ── Exfiltration: moving secrets/env off-box ────────────────────────────
  {
    category: `exfiltration`,
    label: `outbound transfer of environment/secrets`,
    pattern:
      /(curl|wget|fetch|nc|scp|Invoke-WebRequest)\b[\s\S]{0,120}(\$\{?[A-Z_]*(TOKEN|SECRET|KEY|PASS|CRED)|process\.env|printenv|\benv\b)/i,
  },
  {
    category: `exfiltration`,
    label: `environment dump`,
    pattern:
      /\b(printenv|env\s*\|\s*(curl|nc|base64)|process\.env\b[\s\S]{0,40}(post|send|fetch|curl))/i,
  },
  {
    category: `exfiltration`,
    label: `base64-encoded env/secret payload`,
    pattern:
      /base64[\s\S]{0,40}(\$\{?[A-Z_]*(TOKEN|SECRET|KEY|PASS)|process\.env|printenv|\benv\b)/i,
  },
  {
    category: `exfiltration`,
    label: `literal credential token`,
    pattern:
      /\b(tdsk_[A-Za-z0-9_]{8,}|sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{16,}|AKIA[A-Z0-9]{12,})\b/,
  },
  {
    category: `exfiltration`,
    label: `access to a secret/credential file`,
    pattern:
      /\/var\/run\/secrets|\/etc\/shadow|\.ssh\/id_(rsa|ed25519|ecdsa)|\.aws\/credentials|\.kube\/config|\.docker\/config\.json|\.npmrc/i,
  },
  {
    category: `exfiltration`,
    label: `cloud instance metadata endpoint`,
    pattern: /169\.254\.169\.254|metadata\.google\.internal|metadata\.azure\.com/i,
  },
  // ── Prompt injection: rewriting the agent's own behaviour ───────────────
  {
    category: `prompt-injection`,
    label: `override of prior/system instructions`,
    pattern:
      /\b(ignore|disregard|forget|override)\b[\s\S]{0,40}\b(previous|prior|above|earlier|all)\b[\s\S]{0,20}\b(instruction|prompt|rule|directive|context)/i,
  },
  {
    category: `prompt-injection`,
    label: `system-prompt / role reassignment`,
    pattern:
      /\b(you are now|from now on you( are|'re)|act as (an?|the)|your new (role|identity|instructions)|disregard your (system|soul|constitution))\b/i,
  },
  {
    category: `prompt-injection`,
    label: `secrecy / concealment directive`,
    pattern:
      /\b(do not|don't|never)\b[\s\S]{0,30}\b(tell|inform|report|log|mention|reveal)\b[\s\S]{0,30}\b(user|human|owner|admin|operator)\b/i,
  },
  // ── Destructive operations ──────────────────────────────────────────────
  {
    category: `destructive`,
    label: `recursive delete`,
    pattern:
      /\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r|\brm\s+(-[rf]\s+){1,2}|\brm\b[\s\S]{0,20}(--recursive|--force)/i,
  },
  {
    category: `destructive`,
    label: `destructive SQL`,
    pattern:
      /\b(DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\s+TABLE|DELETE\s+FROM\s+\w+\s*;)/i,
  },
  {
    category: `destructive`,
    label: `cluster/resource deletion`,
    pattern:
      /\bkubectl\s+delete\b|\bhelm\s+(uninstall|delete)\b|\bdocker\s+(rm|rmi)\s+-f/i,
  },
  {
    category: `destructive`,
    label: `disk / filesystem wipe`,
    pattern: /\b(dd\s+if=|mkfs\.|>\s*\/dev\/sd|shred\s+)/i,
  },
  {
    category: `destructive`,
    label: `force push to a protected branch`,
    pattern:
      /\bgit\s+push\b[\s\S]{0,40}(--force|-f)\b[\s\S]{0,40}\b(main|master|production)\b|\bgit\s+push\b[\s\S]{0,20}(--force|-f)/i,
  },
  {
    category: `destructive`,
    label: `fork bomb`,
    pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/,
  },
]

/** Agent tools a self-authored skill may activate without review escalation. */
const SafeSkillTools = new Set<string>([
  EAgentTool.mkdir,
  EAgentTool.listDir,
  EAgentTool.readFile,
  EAgentTool.webFetch,
  EAgentTool.webSearch,
  EAgentTool.writeFile,
  EAgentTool.shellExec,
  EAgentTool.deleteFile,
  EAgentTool.fileExists,
  EAgentTool.evalCode,
  EAgentTool.createArtifact,
  EAgentTool.memoryWrite,
  EAgentTool.memorySearch,
  EAgentTool.skillsList,
  EAgentTool.skillView,
])

/**
 * Normalize text before scanning so trivial obfuscation cannot slip a pattern
 * past the regex rules: NFKC-fold width/compatibility variants and strip
 * zero-width and bidirectional-control characters (fullwidth chars,
 * RTL-override tricks). The model reads through these semantically, so the
 * scanner must too.
 */
const normalizeScanText = (text: string): string =>
  text.normalize(`NFKC`).replace(/[\u200B-\u200D\u2060\uFEFF\u202A-\u202E]/g, ``)

/**
 * Run the deterministic scan over a proposal. Returns `{ passed, findings }`;
 * `passed` is false whenever any finding is present (fail-closed).
 */
export const scanSkillProposal = (
  proposal: Pick<
    TSkillAuthorInput,
    `name` | `description` | `instructions` | `tools` | `triggerKeywords`
  >
): TScanResult => {
  const findings: string[] = []
  // Scan every field that reaches the model prompt: name/description/instructions
  // AND triggerKeywords + tool names (all surfaced via skillView / activation).
  const text = normalizeScanText(
    [
      proposal.name,
      proposal.description,
      proposal.instructions,
      ...(proposal.triggerKeywords ?? []),
      ...(proposal.tools ?? []),
    ].join(`\n`)
  )

  for (const rule of TextScanRules) {
    if (rule.pattern.test(text)) findings.push(`[${rule.category}] ${rule.label}`)
  }

  // Tool escalation: unknown tool names (typo / injected) and self-replication
  // (a skill that grants skill-authoring) are flagged.
  for (const tool of proposal.tools ?? []) {
    if (tool === EAgentTool.authorSkill)
      findings.push(`[tool-escalation] skill grants authorSkill (self-replication)`)
    else if (!SafeSkillTools.has(tool))
      findings.push(`[tool-escalation] unknown or disallowed tool "${tool}"`)
  }

  return { passed: findings.length === 0, findings }
}
