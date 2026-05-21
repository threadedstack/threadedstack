export type TMockFile = {
  path: string
  type: 'file' | 'folder'
  depth: number
  lang?: string
  open?: boolean
}

export const mockFiles: TMockFile[] = [
  { path: 'src', type: 'folder', depth: 0, open: true },
  { path: 'src/agent.ts', type: 'file', depth: 1, lang: 'ts' },
  { path: 'src/tools.ts', type: 'file', depth: 1, lang: 'ts' },
  { path: 'src/proxy.ts', type: 'file', depth: 1, lang: 'ts' },
  { path: 'src/lib', type: 'folder', depth: 1, open: false },
  { path: 'tests', type: 'folder', depth: 0, open: false },
  { path: 'package.json', type: 'file', depth: 0, lang: 'json' },
  { path: 'tdsk.config.ts', type: 'file', depth: 0, lang: 'ts' },
  { path: 'README.md', type: 'file', depth: 0, lang: 'md' },
  { path: '.gitignore', type: 'file', depth: 0, lang: 'gi' },
]
