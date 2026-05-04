import { EventEmitter } from 'node:events'

export type AgentRealtimePayload = Record<string, unknown> & {
  type: string
}

type AgentRealtimeHandler = (orgId: string, payload: AgentRealtimePayload) => void

const AGENT_REALTIME_EVENT = 'agent-realtime'
const realtimeBus = new EventEmitter()

realtimeBus.setMaxListeners(100)

export function emitAgentRealtimeEvent(orgId: string, payload: AgentRealtimePayload) {
  if (!orgId || !payload.type) return
  realtimeBus.emit(AGENT_REALTIME_EVENT, orgId, payload)
}

export function subscribeAgentRealtimeEvents(handler: AgentRealtimeHandler): () => void {
  realtimeBus.on(AGENT_REALTIME_EVENT, handler)
  return () => realtimeBus.off(AGENT_REALTIME_EVENT, handler)
}
