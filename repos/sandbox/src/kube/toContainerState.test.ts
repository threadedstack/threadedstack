import { describe, it, expect } from 'vitest'
import type { V1Pod } from '@kubernetes/client-node'
import { EContainerState } from '@tdsk/domain'

import { toContainerState, getTerminationReason } from './toContainerState'

describe(`toContainerState`, () => {
  it(`returns the phase cast to EContainerState when it is a recognized phase`, () => {
    expect(toContainerState(`Running`)).toBe(EContainerState.Running)
  })

  it(`returns EContainerState.Unknown for an unrecognized phase string`, () => {
    expect(toContainerState(`BogusPhase`)).toBe(EContainerState.Unknown)
  })

  it(`returns EContainerState.Unknown when no phase is passed`, () => {
    expect(toContainerState()).toBe(EContainerState.Unknown)
  })
})

describe(`getTerminationReason`, () => {
  it(`returns undefined when containerStatuses is missing`, () => {
    const pod = { status: {} } as V1Pod
    expect(getTerminationReason(pod)).toBeUndefined()
  })

  it(`returns undefined when containerStatuses is an empty array`, () => {
    const pod = { status: { containerStatuses: [] } } as unknown as V1Pod
    expect(getTerminationReason(pod)).toBeUndefined()
  })

  it(`returns lastState.terminated.reason when present (lastState takes priority)`, () => {
    const pod = {
      status: {
        containerStatuses: [
          {
            lastState: { terminated: { reason: `OOMKilled` } },
            state: { terminated: { reason: `Completed` } },
          },
        ],
      },
    } as unknown as V1Pod

    expect(getTerminationReason(pod)).toBe(`OOMKilled`)
  })

  it(`falls back to state.terminated.reason when lastState.terminated is absent`, () => {
    const pod = {
      status: {
        containerStatuses: [
          {
            lastState: {},
            state: { terminated: { reason: `Error` } },
          },
        ],
      },
    } as unknown as V1Pod

    expect(getTerminationReason(pod)).toBe(`Error`)
  })

  it(`returns undefined when neither lastState.terminated nor state.terminated is present`, () => {
    const pod = {
      status: {
        containerStatuses: [{ lastState: {}, state: { running: {} } }],
      },
    } as unknown as V1Pod

    expect(getTerminationReason(pod)).toBeUndefined()
  })
})
