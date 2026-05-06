import { WebSocket } from 'ws'
import type { TinfizSocket } from './types'

const rooms = new Map<string, Set<TinfizSocket>>()

export function send(socket: TinfizSocket, data: unknown) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data))
  }
}

export function addSocketToRoom(orgId: string, socket: TinfizSocket) {
  const existingRoom = rooms.get(orgId)
  if (existingRoom) {
    existingRoom.add(socket)
    return
  }

  rooms.set(orgId, new Set([socket]))
}

export function removeSocketFromRoom(orgId: string, socket: TinfizSocket) {
  const room = rooms.get(orgId)
  if (!room) return

  room.delete(socket)
  if (room.size === 0) {
    rooms.delete(orgId)
  }
}

export function broadcastToAgents(orgId: string, data: unknown) {
  rooms.get(orgId)?.forEach((socket) => {
    if (socket.isAgent) send(socket, data)
  })
}

export function sendToVisitorSocket(orgId: string, visitorId: string, data: unknown): boolean {
  let delivered = false

  rooms.get(orgId)?.forEach((socket) => {
    if (!socket.isAgent && socket.visitorId === visitorId && socket.readyState === WebSocket.OPEN) {
      send(socket, data)
      delivered = true
    }
  })

  return delivered
}

