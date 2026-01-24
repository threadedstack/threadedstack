export const AllowedCommands = new Set([
  `git`,
  `ls`,
  `echo`,
  `grep`,
  `npm`,
  `pnpm`,
  `yarn`,
  `pip`,
  `pdm`,
  `uv`,
  `cat`,
  `rm`,
  `mv`,
  `cp`,
  `mkdir`,
])

// Robust Security Regex: Block Directory Traversal, Absolute Paths, and Shell Injection
export const BlockedPatterns = [/\.\./, /^\//, /&|\||;|`|\$|<|>/]
