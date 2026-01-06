export type TKubeMeta = [`--namespace`, string, `--kube-context`, string] & {
  context?: string
  namespace?: string
}
