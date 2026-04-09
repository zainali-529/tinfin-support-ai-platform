import { useState, useRef, useEffect, useCallback } from 'react'
import { useChat } from './useChat'
import { useWidgetConfig } from './useWidgetConfig'
import { useVapiCall, formatDuration } from './useVapiCall'
import {
  SendIcon, CloseIcon, ChatIcon, BotIcon, AgentIcon, NewChatIcon,
  PhoneIcon, PhoneOffIcon, MicIcon, MicOffIcon,
} from './icons'
import { STYLES } from './styles'
import type { WidgetConfig, VisitorInfo } from './types'

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function formatDate(d: Date) {
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return formatTime(d)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' + formatTime(d)
}

function formatRelativeTimestamp(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const deltaMs = Date.now() - date.getTime()
  const deltaMins = Math.floor(deltaMs / 60_000)
  if (deltaMins < 1) return 'Now'
  if (deltaMins < 60) return `${deltaMins}m`
  if (deltaMins < 60 * 24) return `${Math.floor(deltaMins / 60)}h`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const LAUNCHER_PX: Record<string, number> = { sm: 48, md: 56, lg: 64 }

type ActiveTab = 'inbox' | 'chat' | 'call'

export default function Widget({ config: staticConfig }: { config: WidgetConfig }) {
  const { config } = useWidgetConfig(staticConfig.orgId, staticConfig)

  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<ActiveTab>('inbox')
  const [input, setInput] = useState('')
  const [showNewChatConfirm, setShowNewChatConfirm] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [formError, setFormError] = useState('')
  const autoOpenDone = useRef(false)

  const {
    messages, conversations, activeConversation, activeConversationId,
    typing, connected, agentActive, visitorInfo,
    sendMessage, sendTyping, startNewChat, openConversation, refreshInbox, initWithVisitorInfo,
  } = useChat(config.orgId)

  // ── Vapi Voice Call ────────────────────────────────────────────────────────
  const vapiCallOptions = (config.voiceEnabled && config.vapiPublicKey && config.vapiAssistantId)
    ? {
        publicKey: config.vapiPublicKey,
        assistantId: config.vapiAssistantId,
        orgId: config.orgId,
        visitorId: visitorInfo ? undefined : undefined, // set after visitor identified
        visitorName: visitorInfo?.name,
        visitorEmail: visitorInfo?.email,
      }
    : null

  const {
    callState,
    isMuted,
    volumeLevel,
    transcript: callTranscript,
    errorMessage: callError,
    callDurationSeconds,
    startCall,
    endCall,
    toggleMute,
  } = useVapiCall(vapiCallOptions)

  const isCallActive = callState === 'active' || callState === 'connecting' || callState === 'ending'

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const color = config.primaryColor || '#6366f1'
  const userBubbleColor = config.userBubbleColor || color
  const launcherPx = LAUNCHER_PX[config.launcherSize || 'md'] ?? 56
  const borderRadius = config.borderRadius ?? 20
  const widgetWidth = config.widgetWidth ?? 380
  const headerStyle = config.headerStyle ?? 'gradient'
  const showTyping = config.showTypingIndicator !== false
  const botName = config.botName || 'AI Assistant'
  const inputPlaceholder = config.inputPlaceholder || 'Type a message...'
  const responseTimeText = config.responseTimeText || 'AI · We reply instantly'

  const isLeft = config.position === 'bottom-left' || config.position === 'top-left'
  const isTop = config.position === 'top-left' || config.position === 'top-right'
  const showPreChat = !visitorInfo

  // Auto-open logic
  useEffect(() => {
    if (!config.autoOpen || autoOpenDone.current) return
    const delay = (config.autoOpenDelay ?? 5) * 1000
    const timer = setTimeout(() => {
      setOpen(true)
      autoOpenDone.current = true
    }, delay)
    return () => clearTimeout(timer)
  }, [config.autoOpen, config.autoOpenDelay])

  // When call ends, switch back to chat tab
  useEffect(() => {
    if (callState === 'ended' || callState === 'error') {
      if (tab === 'call') setTimeout(() => setTab('chat'), 1500)
    }
  }, [callState, tab])

  const dynamicStyles = `
    .launcher {
      width: ${launcherPx}px !important;
      height: ${launcherPx}px !important;
    }
    .window {
      width: ${widgetWidth}px !important;
      border-radius: ${borderRadius}px !important;
    }
    .bubble { border-radius: ${Math.max(borderRadius - 4, 8)}px; }
    .bubble.user { background: ${userBubbleColor} !important; border-radius: ${Math.max(borderRadius - 4, 8)}px; border-bottom-right-radius: 4px !important; }
    .bubble.agent { border-radius: ${Math.max(borderRadius - 4, 8)}px; border-bottom-left-radius: 4px !important; }
    .bubble.bot { border-radius: ${Math.max(borderRadius - 4, 8)}px; border-bottom-left-radius: 4px !important; }
    .input-wrap { border-radius: ${Math.max(borderRadius - 8, 6)}px; }
    .inbox-item { border-radius: ${Math.max(borderRadius - 8, 8)}px; }
    .prechat-field input { border-radius: ${Math.max(borderRadius - 8, 8)}px; }
    .prechat-submit { border-radius: ${Math.max(borderRadius - 6, 8)}px; }
    .inbox-start-btn { border-radius: ${Math.max(borderRadius - 8, 8)}px; }
    .inbox-refresh-btn { border-radius: ${Math.max(borderRadius - 8, 8)}px; }
    .call-btn { border-radius: ${Math.max(borderRadius - 8, 8)}px; }
    @media (max-width: 440px) {
      .window { width: calc(100vw - 16px) !important; }
    }
  `

  const headerBg = headerStyle === 'gradient'
    ? `linear-gradient(135deg, ${color}, ${color}cc)`
    : color

  useEffect(() => {
    if (open) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
    }
  }, [messages, typing, open])

  useEffect(() => {
    if (open && !showPreChat) refreshInbox()
  }, [open, showPreChat, refreshInbox])

  const handleSend = useCallback(() => {
    if (!activeConversationId) return
    if (activeConversation?.status === 'resolved' || activeConversation?.status === 'closed') return
    const text = input.trim()
    if (!text) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    sendMessage(text)
    setTab('chat')
  }, [activeConversation?.status, activeConversationId, input, sendMessage])

  const handleStartChat = useCallback(() => {
    startNewChat()
    setTab('chat')
  }, [startNewChat])

  const handleStartCall = useCallback(async () => {
    setTab('call')
    await startCall()
  }, [startCall])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 100) + 'px'
    sendTyping(e.target.value.length > 0)
  }

  const handlePreChatSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nameInput.trim()) { setFormError('Please enter your name.'); return }
    if (!emailInput.trim() || !emailInput.includes('@')) { setFormError('Please enter a valid email.'); return }
    setFormError('')
    const info: VisitorInfo = { name: nameInput.trim(), email: emailInput.trim().toLowerCase() }
    initWithVisitorInfo(info)
  }

  const statusText = !connected
    ? config.offlineMessage || 'Connecting...'
    : agentActive ? 'Agent is online' : responseTimeText
  const statusColor = !connected ? '#f87171' : agentActive ? '#34d399' : '#4ade80'
  const isResolvedConversation = activeConversation?.status === 'resolved' || activeConversation?.status === 'closed'
  const companyName = config.companyName || 'Support'
  const voiceEnabled = config.voiceEnabled && config.vapiPublicKey && config.vapiAssistantId

  // Tab count for dynamic rendering
  const tabCount = voiceEnabled ? 3 : 2

  return (
    <>
      <style>{STYLES}</style>
      <style>{dynamicStyles}</style>

      <div className={`window ${isLeft ? 'left' : ''} ${isTop ? 'top' : ''} ${open ? '' : 'hidden'}`}>
        {/* Header */}
        <div className="header" style={{ background: headerBg }}>
          <div className="header-avatar">
            {config.logoUrl
              ? <img src={config.logoUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              : agentActive ? <AgentIcon /> : '💬'
            }
          </div>
          <div className="header-info">
            <div className="header-name">{companyName}</div>
            <div className="header-status">
              <span className="status-dot" style={{ background: statusColor }} />
              {isCallActive
                ? `🎙️ Call · ${formatDuration(callDurationSeconds)}`
                : statusText
              }
            </div>
          </div>
          <div className="header-actions">
            {!showPreChat && (
              <button className="header-btn" onClick={() => setShowNewChatConfirm(true)} title="New conversation">
                <NewChatIcon />
              </button>
            )}
            <button className="close-btn" onClick={() => setOpen(false)}>
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* New Chat Confirm */}
        {showNewChatConfirm && (
          <div className="confirm-overlay">
            <div className="confirm-box">
              <p>Start a new conversation?</p>
              <p className="confirm-sub">Your current chat history will be cleared.</p>
              <div className="confirm-actions">
                <button className="confirm-cancel" onClick={() => setShowNewChatConfirm(false)}>Cancel</button>
                <button className="confirm-ok" style={{ background: color }}
                  onClick={() => { startNewChat(); setShowNewChatConfirm(false) }}>
                  Start New
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pre-Chat Form */}
        {showPreChat ? (
          <div className="prechat">
            <div className="prechat-welcome">
              <div className="prechat-icon">👋</div>
              <h2>Welcome!</h2>
              <p>{config.welcomeMessage || 'Tell us a bit about yourself to get started.'}</p>
            </div>
            <form className="prechat-form" onSubmit={handlePreChatSubmit}>
              <div className="prechat-field">
                <label>Your Name</label>
                <input type="text" placeholder="e.g. Ali Hassan" value={nameInput}
                  onChange={e => setNameInput(e.target.value)} autoFocus />
              </div>
              <div className="prechat-field">
                <label>Email Address</label>
                <input type="email" placeholder="e.g. ali@example.com" value={emailInput}
                  onChange={e => setEmailInput(e.target.value)} />
              </div>
              {formError && <p className="prechat-error">{formError}</p>}
              <button type="submit" className="prechat-submit" style={{ background: color }}>
                Start Chat →
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="tabs" style={{ gridTemplateColumns: `repeat(${tabCount}, 1fr)` }}>
              <button
                className={`tab-btn ${tab === 'inbox' ? 'active' : ''}`}
                style={tab === 'inbox' ? { borderBottomColor: color, color } : {}}
                onClick={() => setTab('inbox')}>
                Inbox
              </button>
              <button
                className={`tab-btn ${tab === 'chat' ? 'active' : ''}`}
                style={tab === 'chat' ? { borderBottomColor: color, color } : {}}
                onClick={() => setTab('chat')}>
                Chat
              </button>
              {voiceEnabled && (
                <button
                  className={`tab-btn ${tab === 'call' ? 'active' : ''} ${isCallActive ? 'tab-active-call' : ''}`}
                  style={tab === 'call' ? { borderBottomColor: color, color } : {}}
                  onClick={() => setTab('call')}>
                  {isCallActive ? `📞 ${formatDuration(callDurationSeconds)}` : '📞 Call'}
                </button>
              )}
            </div>

            {/* Inbox Tab */}
            {tab === 'inbox' && (
              <div className="inbox-list">
                <div className="inbox-top-actions">
                  <button className="inbox-start-btn" style={{ background: color }} onClick={handleStartChat}>
                    💬 Chat
                  </button>
                  {voiceEnabled && (
                    <button
                      className="inbox-start-btn call-btn"
                      style={{
                        background: isCallActive ? '#16a34a' : '#059669',
                        flex: '0 0 auto',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                      onClick={isCallActive ? () => setTab('call') : handleStartCall}
                    >
                      <PhoneIcon />
                      {isCallActive ? `Active · ${formatDuration(callDurationSeconds)}` : (config.callButtonLabel || 'Talk to AI')}
                    </button>
                  )}
                  <button className="inbox-refresh-btn" onClick={refreshInbox}>Refresh</button>
                </div>
                {conversations.length === 0 ? (
                  <div className="inbox-empty">
                    <div className="welcome-title">No conversations yet</div>
                    <div className="welcome-sub">
                      {voiceEnabled
                        ? 'Start a chat or call our AI assistant.'
                        : 'Start a chat and it will appear here.'
                      }
                    </div>
                  </div>
                ) : (
                  conversations.map((conversation) => {
                    const selected = conversation.id === activeConversationId
                    const title = conversation.contactName || conversation.contactEmail || visitorInfo?.name || 'Conversation'
                    const preview = conversation.lastMessage || 'No messages yet'
                    return (
                      <button key={conversation.id}
                        className={`inbox-item ${selected ? 'selected' : ''}`}
                        onClick={() => { openConversation(conversation.id); setTab('chat') }}>
                        <div className="inbox-item-row">
                          <span className="inbox-item-title">{title}</span>
                          <span className="inbox-item-time">{formatRelativeTimestamp(conversation.lastMessageAt)}</span>
                        </div>
                        <div className="inbox-item-preview">{preview}</div>
                        <div className="inbox-item-meta">
                          <span className={`inbox-status status-${conversation.status}`}>{conversation.status}</span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            )}

            {/* Chat Tab */}
            {tab === 'chat' && (
              <>
                <div className="messages">
                  {!activeConversationId ? (
                    <div className="welcome">
                      <div className="welcome-title">Hi {visitorInfo?.name?.split(' ')[0]}! 👋</div>
                      <div className="welcome-sub">
                        {voiceEnabled
                          ? 'Send a message or click 📞 Call to talk to our AI.'
                          : 'Start a chat from Inbox to begin messaging.'
                        }
                      </div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="welcome">
                      <div className="welcome-title">Conversation started</div>
                      <div className="welcome-sub">Send your first message to continue.</div>
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isSystem = msg.content.startsWith('—') && msg.content.endsWith('—')
                      const prevMsg = messages[idx - 1]
                      const showDate = !prevMsg || msg.createdAt.getTime() - prevMsg.createdAt.getTime() > 5 * 60 * 1000

                      return (
                        <div key={msg.id}>
                          {showDate && !isSystem && (
                            <div className="time-divider"><span>{formatDate(msg.createdAt)}</span></div>
                          )}
                          {isSystem ? (
                            <div className="system-msg">{msg.content}</div>
                          ) : (
                            <div className={`msg-row ${msg.role === 'user' ? 'user' : ''}`}>
                              {msg.role !== 'user' && (
                                <div className="msg-avatar" style={{ background: `${color}22`, color }}>
                                  {msg.role === 'agent' ? <AgentIcon /> : <BotIcon />}
                                </div>
                              )}
                              <div className="msg-bubble-group">
                                {msg.role === 'assistant' && (
                                  <div style={{ fontSize: '10px', color: '#9ca3af', paddingLeft: '2px', marginBottom: '1px' }}>{botName}</div>
                                )}
                                <div
                                  className={`bubble ${msg.role === 'user' ? 'user' : msg.role === 'agent' ? 'agent' : 'bot'}`}
                                  style={
                                    msg.role === 'user' ? { background: userBubbleColor }
                                    : msg.role === 'agent' ? { background: '#059669' }
                                    : {}
                                  }
                                >
                                  {msg.content}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}

                  {showTyping && typing && activeConversationId && (
                    <div className="msg-row">
                      <div className="msg-avatar" style={{ background: `${color}22`, color }}>
                        <BotIcon />
                      </div>
                      <div className="typing"><span /><span /><span /></div>
                    </div>
                  )}

                  <div ref={messagesEndRef} style={{ height: 1 }} />
                </div>

                <div className="footer">
                  <div className="input-wrap">
                    <textarea
                      ref={textareaRef} rows={1}
                      placeholder={
                        !activeConversationId ? 'Start a chat from Inbox...'
                        : isResolvedConversation ? 'This conversation is resolved'
                        : !connected ? (config.offlineMessage || 'Reconnecting...')
                        : inputPlaceholder
                      }
                      value={input}
                      onChange={handleInput}
                      onKeyDown={handleKey}
                      onBlur={() => sendTyping(false)}
                      disabled={!activeConversationId || isResolvedConversation || !connected}
                    />
                  </div>
                  <button className="send-btn" style={{ background: color }}
                    onClick={handleSend}
                    disabled={!input.trim() || !activeConversationId || isResolvedConversation || !connected}>
                    <SendIcon />
                  </button>
                </div>
              </>
            )}

            {/* Voice Call Tab */}
            {tab === 'call' && voiceEnabled && (
              <VoiceCallPanel
                color={color}
                callState={callState}
                isMuted={isMuted}
                volumeLevel={volumeLevel}
                callDurationSeconds={callDurationSeconds}
                callTranscript={callTranscript}
                callError={callError}
                botName={botName}
                onStartCall={handleStartCall}
                onEndCall={endCall}
                onToggleMute={toggleMute}
                callButtonLabel={config.callButtonLabel || 'Talk to AI'}
              />
            )}
          </>
        )}

        {config.showBranding !== false && (
          <div className="branding">
            Powered by <a href="https://tinfin.com" target="_blank" rel="noopener">Tinfin</a>
          </div>
        )}
      </div>

      {/* Launcher */}
      <button
        className={`launcher ${isLeft ? 'left' : ''} ${isTop ? 'top' : ''} ${isCallActive ? 'launcher-call-active' : ''}`}
        style={{ background: isCallActive ? '#16a34a' : headerBg }}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {isCallActive ? <PhoneIcon /> : open ? <CloseIcon /> : <ChatIcon />}
      </button>
    </>
  )
}

// ─── Voice Call Panel ─────────────────────────────────────────────────────────

interface VoiceCallPanelProps {
  color: string
  callState: ReturnType<typeof useVapiCall>['callState']
  isMuted: boolean
  volumeLevel: number
  callDurationSeconds: number
  callTranscript: ReturnType<typeof useVapiCall>['transcript']
  callError: string | null
  botName: string
  callButtonLabel: string
  onStartCall: () => Promise<void>
  onEndCall: () => void
  onToggleMute: () => void
}

function VoiceCallPanel({
  color, callState, isMuted, volumeLevel, callDurationSeconds,
  callTranscript, callError, botName, callButtonLabel,
  onStartCall, onEndCall, onToggleMute,
}: VoiceCallPanelProps) {
  const isActive = callState === 'active'
  const isConnecting = callState === 'connecting' || callState === 'ending'
  const isIdle = callState === 'idle' || callState === 'ended' || callState === 'error'

  // Volume animation bars
  const barCount = 5
  const bars = Array.from({ length: barCount }, (_, i) => {
    const threshold = (i + 1) / barCount
    return volumeLevel >= threshold
  })

  return (
    <div className="call-panel">
      {/* AI Avatar with pulse animation during call */}
      <div className="call-avatar-wrapper">
        <div
          className={`call-avatar ${isActive ? 'call-avatar-pulse' : ''}`}
          style={{
            background: isActive ? `${color}22` : '#f3f4f6',
            border: `2px solid ${isActive ? color : '#e5e7eb'}`,
          }}
        >
          🤖
        </div>

        {/* Volume level indicator */}
        {isActive && (
          <div className="call-volume-bars">
            {bars.map((active, i) => (
              <div
                key={i}
                className="call-volume-bar"
                style={{ background: active ? color : '#e5e7eb' }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="call-status">
        <div className="call-status-name">{botName}</div>
        <div className="call-status-label">
          {callState === 'idle' && callButtonLabel}
          {callState === 'connecting' && 'Connecting...'}
          {callState === 'active' && `🎙️ ${formatDuration(callDurationSeconds)}`}
          {callState === 'ending' && 'Ending call...'}
          {callState === 'ended' && '✅ Call ended'}
          {callState === 'error' && `❌ ${callError ?? 'Call failed'}`}
        </div>
      </div>

      {/* Transcript */}
      {callTranscript.length > 0 && (
        <div className="call-transcript">
          {callTranscript.slice(-4).map((entry, i) => (
            <div key={i} className={`call-transcript-entry ${entry.role}`}>
              <span className="call-transcript-role">{entry.role === 'user' ? 'You' : botName}</span>
              <span className="call-transcript-text">{entry.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="call-controls">
        {isIdle && (
          <button
            className="call-start-btn"
            style={{ background: color }}
            onClick={onStartCall}
          >
            <PhoneIcon />
            {callState === 'error' ? 'Try Again' : callButtonLabel}
          </button>
        )}

        {(isActive || isConnecting) && (
          <>
            <button
              className={`call-control-btn ${isMuted ? 'call-control-active' : ''}`}
              style={isMuted ? { background: '#fee2e2', color: '#dc2626' } : {}}
              onClick={onToggleMute}
              disabled={!isActive}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOffIcon /> : <MicIcon />}
              <span>{isMuted ? 'Unmuted' : 'Mute'}</span>
            </button>

            <button
              className="call-end-btn"
              onClick={onEndCall}
              title="End call"
            >
              <PhoneOffIcon />
              <span>End Call</span>
            </button>
          </>
        )}
      </div>

      {/* Disclaimer */}
      <p className="call-disclaimer">
        This call may be recorded for quality purposes.
      </p>
    </div>
  )
}