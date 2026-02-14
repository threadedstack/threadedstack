import { createLLMAdapter as _createLLMAdapter } from '@tdsk/agent'

/**
 * LLM adapter factory — thin wrapper for testability.
 * Tests can use vi.spyOn(llm, 'createLLMAdapter') to intercept.
 */
export const llm = {
  createLLMAdapter: _createLLMAdapter,
}
