import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

/**
 * Render the Helm chart's service-account.yaml template and assert on the
 * RBAC rules for tdsk-sandbox-manager.  No kube context is required —
 * `helm template` is a pure offline render.
 */

const DEPLOY_DIR = resolve(__dirname, `../../../../../deploy`)

const helmTemplateArgs = (extraSets: string[]): string[] => [
  `template`,
  `test-release`,
  `./`,
  `-f`,
  `values.empty.yaml`,
  `-f`,
  `values.yaml`,
  ...extraSets.flatMap((s) => [`--set`, s]),
]

const extractRoleBlock = (output: string): string => {
  const roleStart = output.indexOf(`kind: Role`)
  if (roleStart === -1) return ``
  const roleEnd = output.indexOf(`---`, roleStart + 1)
  return roleEnd > roleStart ? output.slice(roleStart, roleEnd) : output.slice(roleStart)
}

const renderRoleWithRules = (): string => {
  const output = execFileSync(
    `helm`,
    helmTemplateArgs([
      `customServiceAccount.name=tdsk-backend-sa`,
      `customServiceAccount.role.name=tdsk-sandbox-manager`,
      // Rule A: existing sandbox management triple
      `customServiceAccount.role.rules[0].apiGroups[0]=`,
      `customServiceAccount.role.rules[0].resources[0]=pods`,
      `customServiceAccount.role.rules[0].resources[1]=pods/exec`,
      `customServiceAccount.role.rules[0].verbs[0]=create`,
      `customServiceAccount.role.rules[0].verbs[1]=delete`,
      `customServiceAccount.role.rules[0].verbs[2]=get`,
      `customServiceAccount.role.rules[0].verbs[3]=list`,
      `customServiceAccount.role.rules[0].verbs[4]=patch`,
      `customServiceAccount.role.rules[0].verbs[5]=watch`,
      // Rule B: ops read tier (pods/log + resourcequotas)
      `customServiceAccount.role.rules[1].apiGroups[0]=`,
      `customServiceAccount.role.rules[1].resources[0]=pods/log`,
      `customServiceAccount.role.rules[1].resources[1]=resourcequotas`,
      `customServiceAccount.role.rules[1].verbs[0]=get`,
      `customServiceAccount.role.rules[1].verbs[1]=list`,
      `customServiceAccount.role.rules[1].verbs[2]=watch`,
      // Rule C: deployments (ops read + restart write)
      `customServiceAccount.role.rules[2].apiGroups[0]=apps`,
      `customServiceAccount.role.rules[2].resources[0]=deployments`,
      `customServiceAccount.role.rules[2].verbs[0]=get`,
      `customServiceAccount.role.rules[2].verbs[1]=list`,
      `customServiceAccount.role.rules[2].verbs[2]=watch`,
      `customServiceAccount.role.rules[2].verbs[3]=patch`,
      `customServiceAccount.binding.name=tdsk-sandbox-manager-binding`,
    ]),
    { cwd: DEPLOY_DIR, encoding: `utf8` }
  )
  return extractRoleBlock(output)
}

const renderRoleLegacySingleTriple = (): string => {
  const output = execFileSync(
    `helm`,
    helmTemplateArgs([
      `customServiceAccount.name=tdsk-backend-sa`,
      `customServiceAccount.role.name=tdsk-sandbox-manager`,
      `customServiceAccount.role.resources[0]=pods`,
      `customServiceAccount.role.resources[1]=pods/exec`,
      `customServiceAccount.role.verbs[0]=create`,
      `customServiceAccount.role.verbs[1]=delete`,
      `customServiceAccount.role.verbs[2]=get`,
      `customServiceAccount.role.verbs[3]=list`,
      `customServiceAccount.role.verbs[4]=patch`,
      `customServiceAccount.role.verbs[5]=watch`,
      `customServiceAccount.binding.name=tdsk-sandbox-manager-binding`,
    ]),
    { cwd: DEPLOY_DIR, encoding: `utf8` }
  )
  return extractRoleBlock(output)
}

describe(`deploy/templates/service-account.yaml — RBAC rules rendering`, () => {
  describe(`new rules-array form (tdsk-sandbox-manager with ops read tier)`, () => {
    it(`renders a rule with apiGroups: apps and resources: deployments (Rule C)`, () => {
      const role = renderRoleWithRules()
      expect(role).toContain(`apps`)
      expect(role).toContain(`deployments`)
    })

    it(`renders a rule that includes pods/log (Rule B — ops read tier)`, () => {
      const role = renderRoleWithRules()
      expect(role).toContain(`pods/log`)
    })

    it(`renders a rule that includes resourcequotas (Rule B — ops read tier)`, () => {
      const role = renderRoleWithRules()
      expect(role).toContain(`resourcequotas`)
    })

    it(`still renders the existing pods and pods/exec sandbox management rule (Rule A)`, () => {
      const role = renderRoleWithRules()
      expect(role).toContain(`pods`)
      expect(role).toContain(`pods/exec`)
    })

    it(`Rule C includes patch verb for restartDeployment`, () => {
      const role = renderRoleWithRules()
      const deployBlock = role.slice(role.indexOf(`deployments`))
      expect(deployBlock).toContain(`patch`)
    })
  })

  describe(`backward-compat: legacy single-triple form still renders`, () => {
    it(`renders a single-rule Role with pods and pods/exec`, () => {
      const role = renderRoleLegacySingleTriple()
      expect(role).toContain(`pods`)
      expect(role).toContain(`pods/exec`)
      expect(role).toContain(`create`)
      expect(role).toContain(`watch`)
    })

    it(`does not render apps or deployments in the legacy form`, () => {
      const role = renderRoleLegacySingleTriple()
      expect(role).not.toContain(`apps`)
      expect(role).not.toContain(`deployments`)
    })
  })
})
