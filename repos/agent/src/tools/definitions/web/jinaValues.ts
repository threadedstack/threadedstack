export const SearchBase = `https://s.jina.ai/`
export const ReaderBase = `https://r.jina.ai/`
export const RequestTimeoutMS = 30_000

export const AllowedProtocols = [`http:`, `https:`]
export const BlockedHostnamePatterns = [
  /^localhost$/i,
  /^\[?::1\]?$/,
  /^\[?fe80:/i,
  /^0\.0\.0\.0$/,
  /^\[?fd[0-9a-f]{2}:/i,
  /^169\.254\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^127\.\d+\.\d+\.\d+$/,
  /^metadata\.google\.internal$/i,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  // IPv6-mapped IPv4 (e.g., [::ffff:127.0.0.1])
  /^\[?::ffff:/i,
  // Expanded IPv6 loopback (e.g., [0:0:0:0:0:0:0:1])
  /^\[?0+:0+:0+:0+:0+:0+:0+:0*1\]?$/,
  // Decimal IP encoding (e.g., 2130706433 = 127.0.0.1)
  /^\d{8,10}$/,
  // Hex IP encoding (e.g., 0x7f000001)
  /^0x[0-9a-f]+$/i,
  // Octal IP encoding (e.g., 0177.0.0.1)
  /^0\d+\./,
]
