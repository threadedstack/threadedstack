/**
 * Content classification filter for terminal output.
 *
 * Sits between ChangeDetector and PatternMatcherPipeline to classify
 * sealed-line text as content, chrome (TUI decorations), or loading
 * indicators before it reaches event generation.
 *
 * Solves: TUI apps like Claude Code redraw the full screen on every
 * spinner tick, re-emitting status bars, tab headers, and keyboard
 * shortcut text as new events. This filter suppresses that noise.
 */

export type TContentClass = 'content' | 'chrome' | 'loading'

export type TContentClassifier = {
  isChrome: (text: string) => boolean
  isLoading: (text: string) => boolean
}

// ── Generic chrome patterns (all runtimes) ────────────────────────

const GenericChromePatterns: RegExp[] = [
  // Status bar: 3+ pipe-separated segments — "| glm-5 | API Usage Billing | path |"
  /(?:[│|].*){3,}/,

  // Box drawing borders — lines entirely made of box chars / spaces
  /^[\s┌┐└┘│─┬┴├┤╔╗╚╝║═╦╩╠╣╭╮╯╰━┃┏┓┗┛┣┫┳┻╋]+$/,

  // Lines that are only pipes, dashes, and whitespace (table borders)
  /^[\s│|─\-=+]+$/,
]

/**
 * Detects dense keyboard shortcut text by counting modifier keyword
 * occurrences. Real shortcut help lines contain 3+ modifiers scattered
 * through the text (e.g. "ctrl + shift + - to / for commands shift + tab").
 */
function isDenseShortcutText(text: string): boolean {
  const matches = text.match(/\b(?:ctrl|shift|alt|meta|cmd|esc|tab|enter|return)\b/gi)
  return !!matches && matches.length >= 3
}

// ── Generic loading patterns (all runtimes) ───────────────────────

// Braille spinner characters used by ora, cli-spinners, etc.
const SpinnerChars = `\u280B\u2819\u2839\u2838\u283C\u2834\u2826\u2827\u2807\u280F\u283E\u283D\u283B\u28BF\u28FF\u28DF\u28EF\u28F7`

const GenericLoadingPatterns: RegExp[] = [
  // Braille / unicode spinner prefix followed by text
  new RegExp(`^[${SpinnerChars}⣾⣽⣻⢿⡿⣟⣯⣷✦◐◓◑◒⠿⠾⠽⠻]\\s+`),

  // Common loading verb patterns
  /^(?:Loading|Hashing|Processing|Compiling|Building|Indexing|Searching|Analyzing|Scanning|Resolving|Fetching|Installing)\.\.\./i,

  // Standalone interrupt hints
  /^to interrupt$/i,
  /^press .+ to (?:cancel|interrupt|stop|abort)/i,

  // Esc to cancel / Esc to interrupt
  /^esc to (?:cancel|interrupt|stop)/i,
]

// ── Claude Code specific classifiers ──────────────────────────────

const claudeCodeClassifier: TContentClassifier = {
  isChrome(text: string): boolean {
    // Shortcut hint lines — "? for shortcuts", "! for bash mode"
    if (/^[?!]\s*for\s+(?:shortcuts|bash)/i.test(text)) return true

    // Effort level indicator — "● high · /effort"
    if (/[●•]\s*(?:high|medium|low)\s*[·•]?\s*\/effort/i.test(text)) return true

    // "recent activity" status line
    if (/^recent activity\s*[│|]/i.test(text)) return true

    // Welcome banner with pipe separators
    if (/^Welcome back!\s*[│|]/.test(text)) return true

    // Model/tips/menu bar — lines with "Tips for getting started" etc.
    if (/Tips for getting started/.test(text)) return true

    // Tab-like headers — "| Blog | Recipes | Threads |"
    if (/^[│|]\s+\w+\s+[│|]\s+\w+\s+[│|]/.test(text)) return true

    // "* ●" or "↑ ●" decorative indicators
    if (/^[*↑↓←→]\s*[●•]$/.test(text)) return true

    return false
  },
  isLoading(text: string): boolean {
    // "⊕ Hashing..." with special prefix chars
    if (/^[⊕⊖⊗⊘]\s+\w+\.\.\./i.test(text)) return true

    return false
  },
}

// ── Classifier registry ───────────────────────────────────────────

const classifierRegistry = new Map<string, TContentClassifier>()
classifierRegistry.set('claude-code', claudeCodeClassifier)

export const getContentClassifier = (runtime: string): TContentClassifier | undefined =>
  classifierRegistry.get(runtime)

export const registerContentClassifier = (
  runtime: string,
  classifier: TContentClassifier
) => classifierRegistry.set(runtime, classifier)

// ── Main classification function ──────────────────────────────────

export function classifyContent(text: string, runtime?: string): TContentClass {
  // Check generic chrome patterns
  for (const pattern of GenericChromePatterns) {
    if (pattern.test(text)) return 'chrome'
  }

  // Check dense keyboard shortcut text
  if (isDenseShortcutText(text)) return 'chrome'

  // Check generic loading patterns
  for (const pattern of GenericLoadingPatterns) {
    if (pattern.test(text)) return 'loading'
  }

  // Check runtime-specific classifier
  if (runtime) {
    const classifier = classifierRegistry.get(runtime)
    if (classifier) {
      if (classifier.isChrome(text)) return 'chrome'
      if (classifier.isLoading(text)) return 'loading'
    }
  }

  return 'content'
}
