import { subscribeAgentRealtimeEvents } from '../services/realtime-events.service'
import { broadcastToAgents } from './rooms'

let unsubscribeAgentRealtimeEvents: (() => void) | null = null

export function startAgentRealtimeBridge() {
  if (unsubscribeAgentRealtimeEvents) return

  unsubscribeAgentRealtimeEvents = subscribeAgentRealtimeEvents((orgId, payload) => {
    broadcastToAgents(orgId, payload)
  })
}

export function stopAgentRealtimeBridge() {
  unsubscribeAgentRealtimeEvents?.()
  unsubscribeAgentRealtimeEvents = null
}
