export const inKube = () => {
  return (
    process.env.TDSK_IN_KUBE ||
    (process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT)
  )
}
