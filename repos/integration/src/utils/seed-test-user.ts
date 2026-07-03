import { loadEnvs } from './loadEnvs'

/**
 * Standalone environment repair: ensure the integration test user exists in
 * Neon Auth with the password from TDSK_IT_USER_PASSWORD, so `acquireJwt`
 * (jwt-auth.ts) can sign in. Idempotent: signs in first and exits clean when
 * the credentials already work; otherwise attempts email/password sign-up.
 *
 * Run from repos/integration:
 *   pnpm exec tsx src/utils/seed-test-user.ts
 *
 * Requires TDSK_IT_AUTH_URL, TDSK_IT_USER_EMAIL, TDSK_IT_USER_PASSWORD from
 * the values.yaml chain. Note: if the Neon Auth project requires email
 * verification before sign-in, the script reports that explicitly — the
 * verification click is the only step it cannot perform.
 */

loadEnvs()

const authUrl = process.env.TDSK_IT_AUTH_URL
const email = process.env.TDSK_IT_USER_EMAIL
const password = process.env.TDSK_IT_USER_PASSWORD
const Origin = `http://localhost:5887`

if (!authUrl || !email || !password) {
  console.error(
    `[seed-test-user] Missing TDSK_IT_AUTH_URL, TDSK_IT_USER_EMAIL, or TDSK_IT_USER_PASSWORD`
  )
  process.exit(1)
}

const signIn = async (): Promise<Response> =>
  fetch(`${authUrl}/sign-in/email`, {
    method: `POST`,
    headers: { 'Content-Type': `application/json`, Origin },
    body: JSON.stringify({ email, password }),
    redirect: `manual`,
  })

const preCheck = await signIn()
if (preCheck.ok) {
  console.log(`[seed-test-user] Sign-in already works for ${email} — nothing to do`)
  process.exit(0)
}

console.log(
  `[seed-test-user] Sign-in failed (${preCheck.status}) — attempting sign-up for ${email}`
)

const signUpRes = await fetch(`${authUrl}/sign-up/email`, {
  method: `POST`,
  headers: { 'Content-Type': `application/json`, Origin },
  body: JSON.stringify({ email, password, name: `Integration Test User` }),
  redirect: `manual`,
})

if (!signUpRes.ok) {
  const body = await signUpRes.text()
  console.error(`[seed-test-user] Sign-up failed (${signUpRes.status}): ${body}`)
  console.error(
    `[seed-test-user] If the user already exists with a DIFFERENT password, update` +
      ` TDSK_IT_USER_PASSWORD in ~/.config/tdsk/values.yaml or reset the user in the Neon console`
  )
  process.exit(1)
}

const postCheck = await signIn()
if (postCheck.ok) {
  console.log(`[seed-test-user] User created and sign-in verified for ${email}`)
  process.exit(0)
}

const body = await postCheck.text()
console.error(
  `[seed-test-user] User created but sign-in still fails (${postCheck.status}): ${body}`
)
console.error(
  `[seed-test-user] The Neon Auth project likely requires email verification —` +
    ` verify ${email} via its inbox or mark it verified in the Neon console, then re-run`
)
process.exit(1)
