/**
 * Monaco Editor Configuration Constants
 */

export const MonacoOptions = {
  fontSize: 14,
  automaticLayout: true,
  wordWrap: `on` as const,
  lineNumbers: `on` as const,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  renderLineHighlight: `all` as const,
}

export const VSCodeSSHConfig = `Host sandbox-*\n  ProxyCommand tsa proxy %h\n  User sandbox\n  StrictHostKeyChecking no\n  UserKnownHostsFile /dev/null`
