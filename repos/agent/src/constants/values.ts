export const AllowedCommands = new Set([
  `git`,
  `ls`,
  `echo`,
  `grep`,
  `npm`,
  `cat`,
  `rm`,
  `mkdir`,
])

// Robust Security Regex: Block Directory Traversal, Absolute Paths, and Shell Injection
export const BlockedPatterns = [/\.\./, /^\//, /&|\||;|`|\$|<|>/]
