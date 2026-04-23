/**
 * apps/widget/src/useVapiCall.ts
 *
 * React hook wrapping the @vapi-ai/web SDK.
 * Manages the full lifecycle of a browser-based voice call:
 *   idle → connecting → active → ended
 *
 * The PUBLIC key is safe to bundle in widget code.
 * It allows initiating calls but cannot manage resources.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import type Vapi from '@vapi-ai/web'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CallState = 'idle' | 'connecting' | 'active' | 'ending' | 'ended' | 'error'

export interface VapiCallOptions {
  publicKey: string
  assistantId: string
  orgId: string
  visitorId?: string
  conversationId?: string
  contactId?: string
  visitorName?: string
  visitorEmail?: string
}

export interface UseVapiCallReturn {
  callState: CallState
  isMuted: boolean
  volumeLevel: number       // 0-1 float
  transcript: TranscriptEntry[]
  errorMessage: string | null
  callDurationSeconds: number
  startCall: () => Promise<void>
  endCall: () => void
  toggleMute: () => void
}

export interface TranscriptEntry {
  role: 'user' | 'assistant'
  text: string
  timestamp: Date
}

// ─── Dynamic import helper ────────────────────────────────────────────────────

let vapiModule: typeof Vapi | null = null

async function loadVapi(): Promise<typeof Vapi> {
  if (vapiModule) return vapiModule
  const mod = await import('@vapi-ai/web')
  vapiModule = mod.default ?? (mod as unknown as { default: typeof Vapi }).default
  return vapiModule
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVapiCall(options: VapiCallOptions | null): UseVapiCallReturn {
  const vapiRef = useRef<InstanceType<typeof Vapi> | null>(null)
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [callState, setCallState] = useState<CallState>('idle')
  const [isMuted, setIsMuted] = useState(false)
  const [volumeLevel, setVolumeLevel] = useState(0)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [callDurationSeconds, setCallDurationSeconds] = useState(0)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vapiRef.current) {
        try { vapiRef.current.stop() } catch { /* ignore */ }
      }
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current)
      }
    }
  }, [])

  const startDurationTimer = useCallback(() => {
    setCallDurationSeconds(0)
    durationTimerRef.current = setInterval(() => {
      setCallDurationSeconds((s) => s + 1)
    }, 1000)
  }, [])

  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current)
      durationTimerRef.current = null
    }
  }, [])

  const startCall = useCallback(async () => {
    if (!options) return
    if (callState !== 'idle' && callState !== 'ended' && callState !== 'error') return

    setCallState('connecting')
    setErrorMessage(null)
    setTranscript([])
    setCallDurationSeconds(0)
    setIsMuted(false)
    setVolumeLevel(0)

    try {
      const VapiClass = await loadVapi()

      // Create fresh instance per call
      const vapi = new VapiClass(options.publicKey)
      vapiRef.current = vapi

      // ── Event listeners ─────────────────────────────────────────────────

      vapi.on('call-start', () => {
        setCallState('active')
        startDurationTimer()
      })

      vapi.on('call-end', () => {
        setCallState('ended')
        stopDurationTimer()
        setVolumeLevel(0)
        vapiRef.current = null
      })

      vapi.on('speech-start', () => {
        // Assistant started speaking
      })

      vapi.on('speech-end', () => {
        // Assistant stopped speaking
      })

      vapi.on('volume-level', (level: number) => {
        setVolumeLevel(Math.min(1, Math.max(0, level)))
      })

      vapi.on('message', (msg: {
        type: string
        role?: string
        transcript?: string
        transcriptType?: string
      }) => {
        if (msg.type === 'transcript' && msg.transcriptType === 'final' && msg.transcript) {
          const role = msg.role === 'user' ? 'user' : 'assistant'
          setTranscript((prev) => [
            ...prev,
            { role, text: msg.transcript!, timestamp: new Date() },
          ])
        }
      })

      vapi.on('error', (err: Error | { message?: string }) => {
        const message = err instanceof Error ? err.message : (err?.message ?? 'Call error')
        console.error('[useVapiCall] error:', message)
        setErrorMessage(message)
        setCallState('error')
        stopDurationTimer()
        setVolumeLevel(0)
        vapiRef.current = null
      })

      // ── Start the call ──────────────────────────────────────────────────

      const callContext = {
        orgId: options.orgId,
        ...(options.visitorId ? { visitorId: options.visitorId } : {}),
        ...(options.conversationId ? { conversationId: options.conversationId } : {}),
        ...(options.contactId ? { contactId: options.contactId } : {}),
        ...(options.visitorName ? { visitorName: options.visitorName } : {}),
        ...(options.visitorEmail ? { visitorEmail: options.visitorEmail } : {}),
        source: 'tinfin-widget',
      }

      await vapi.start(options.assistantId, {
        // Keep context in both metadata and variableValues because providers/webhooks
        // may expose one path but not the other.
        metadata: callContext,
        variableValues: callContext,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start call'
      console.error('[useVapiCall] startCall error:', message)
      setErrorMessage(message)
      setCallState('error')
      stopDurationTimer()
      vapiRef.current = null
    }
  }, [options, callState, startDurationTimer, stopDurationTimer])

  const endCall = useCallback(() => {
    if (callState !== 'active' && callState !== 'connecting') return
    setCallState('ending')
    stopDurationTimer()
    try {
      vapiRef.current?.stop()
    } catch {
      // Ignore — onCallEnd will fire
    }
  }, [callState, stopDurationTimer])

  const toggleMute = useCallback(() => {
    if (!vapiRef.current || callState !== 'active') return
    const newMuted = !isMuted
    vapiRef.current.setMuted(newMuted)
    setIsMuted(newMuted)
  }, [isMuted, callState])

  return {
    callState,
    isMuted,
    volumeLevel,
    transcript,
    errorMessage,
    callDurationSeconds,
    startCall,
    endCall,
    toggleMute,
  }
}

// ─── Duration formatter ───────────────────────────────────────────────────────

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}