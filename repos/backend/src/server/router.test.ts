import type { Router } from 'express'

import express from 'express'
import request from 'supertest'
import { describe, it, expect } from 'vitest'
import { createAsyncRouter } from './router'

describe(`createAsyncRouter`, () => {
  it(`should register a route the same way the underlying Router method would`, async () => {
    const router = createAsyncRouter()
    router.get(`/test`, (_req, res) => {
      res.status(200).json({ ok: true })
    })

    const app = express()
    app.use(router as unknown as Router)

    const response = await request(app).get(`/test`)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true })
  })

  it(`should surface a synchronously thrown error via the error-handling middleware`, async () => {
    const router = createAsyncRouter()
    router.get(`/sync-error`, () => {
      throw new Error(`sync failure`)
    })

    const app = express()
    app.use(router as unknown as Router)
    app.use(
      (
        err: Error,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        res.status(500).json({ error: err.message })
      }
    )

    const response = await request(app).get(`/sync-error`)

    expect(response.status).toBe(500)
    expect(response.body).toEqual({ error: `sync failure` })
  })

  it(`should surface a rejected promise error via the error-handling middleware instead of hanging`, async () => {
    const router = createAsyncRouter()
    router.post(`/async-error`, async () => {
      throw new Error(`async failure`)
    })

    const app = express()
    app.use(express.json())
    app.use(router as unknown as Router)
    app.use(
      (
        err: Error,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        res.status(500).json({ error: err.message })
      }
    )

    const response = await request(app).post(`/async-error`).send({})

    expect(response.status).toBe(500)
    expect(response.body).toEqual({ error: `async failure` })
  })
})
