/**
 * Schedule type definitions for the agent scheduling system.
 * Schedules define cron-based triggers that run agents with a given prompt.
 */

/**
 * Agent schedule definition — stored in DB, references an agent and org.
 */
export type TAgentSchedule = {
  id: string
  agentId: string
  orgId: string
  cronExpression: string // e.g., "0 9 * * MON" (9am every Monday)
  prompt: string // The prompt to send on trigger
  enabled: boolean
  lastRunAt?: string | Date
  nextRunAt?: string | Date
  threadId?: string // Optional: append to existing thread
  createThread: boolean // Create new thread per run (default true)
  maxConsecutiveErrors?: number // Disable after N consecutive failures
  consecutiveErrors?: number
  createdAt?: string | Date
  updatedAt?: string | Date
}
