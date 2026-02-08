export type TDownload = {
  /** Override the default wasmtime git tag to use when cloning */
  tag: string
  /** Override the default wasmtime git repo url */
  repo: string
  /** Override the default path to wit deps in the wasmtime git repo */
  source: string
  /** Override the default path where wit deps will be saved */
  target: string
  /** Disable debug logs */
  quiet?: boolean
}

export type TInstallOpts = Partial<TDownload> & {
  /** Path to package.json (required) */
  root: string
  /** WIT directory (default: root/wit) */
  witdir?: string
}
