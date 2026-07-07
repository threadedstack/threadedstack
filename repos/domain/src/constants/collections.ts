/**
 * Constants for the Collections / Records primitive.
 * See docs/superpowers/specs/2026-07-07-collections-records-primitive-design.md
 */

/**
 * Default maximum characters of a single `contextSources` section injected into
 * a cycle prompt. A source may override this with its own `max`. Mirrors the
 * per-builder InjectMaxChars caps (e.g. RunOutcomeInjectMaxChars).
 */
export const ContextSourceInjectMaxChars = 8000
