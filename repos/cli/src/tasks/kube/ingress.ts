import type { TTask, TTaskAction } from '@TSCL/types'
import { kubectl } from '@TSCL/utils/kube/kubectl'
import { taskError } from '@TSCL/utils/tasks/error'

/**
 * Creates a kubernetes ingress in the active namespace
 * @function
 * @public
 * @returns {Void}
 */
const ingressAction: TTaskAction = async (args) => {
  const { params } = args
  const { name, host, path, service, port } = params
  !name && taskError(`Ingress name is required`)
  !host && taskError(`Host is required`)
  !service && taskError(`Service name is required`)

  const ingressYaml = `
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${name}
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: ${path || '/'}
spec:
  rules:
  - host: ${host}
    http:
      paths:
      - path: ${path || '/'}
        pathType: Prefix
        backend:
          service:
            name: ${service}
            port:
              number: ${port || 80}
`.trim()

  // Update params to include input for stdin
  args.params = { ...args.params, input: ingressYaml }
  await kubectl.apply(args, [`-f`, `-`])
}

export const ingress: TTask = {
  name: `ingress`,
  alias: [`ing`, `in`],
  action: ingressAction,
  example: `pnpm tdsk kube ingress <options>`,
  description: `Creates a kubernetes ingress in the active namespace`,
  options: {
    name: {
      required: true,
      description: `Name of the ingress`,
      example: `--name my-ingress`,
      alias: [`n`],
    },
    host: {
      required: true,
      description: `Host name for the ingress`,
      example: `--host example.com`,
      alias: [`h`],
    },
    path: {
      description: `Path for the ingress routing`,
      example: `--path /api`,
      default: `/`,
    },
    service: {
      required: true,
      description: `Name of the service to route to`,
      example: `--service my-service`,
      alias: [`svc`],
    },
    port: {
      description: `Port number for the service`,
      example: `--port 8080`,
      default: 80,
    },
    namespace: {
      alias: [`ns`],
      description: `Kubernetes namespace to use`,
      example: `--namespace my-namespace`,
    },
    context: {
      description: `Kubernetes context to use`,
      example: `--context my-context`,
    },
    log: {
      type: `boolean`,
      description: `Log command before it is run`,
    },
  },
}
