import { useState, useRef, useEffect, useCallback } from 'react'
import { useChat } from './useChat'
import { useWidgetConfig } from './useWidgetConfig'
import { useVapiCall, formatDuration } from './useVapiCall'
import type { Attachment } from './types'
import {
  SendIcon, CloseIcon, ChatIcon, BotIcon, AgentIcon, NewChatIcon,
  PhoneIcon, PhoneOffIcon, MicIcon, MicOffIcon,
  AttachIcon, FileIcon, ImageIcon, XCircleIcon,
} from './icons'
import { STYLES } from './styles'
import type { WidgetConfig, VisitorInfo } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function isImageType(type: string): boolean {
  return type.startsWith('image/')
}

const LAUNCHER_PX: Record<string, number> = { sm: 48, md: 56, lg: 64 }

const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'audio/mpeg', 'audio/wav',
  'video/mp4',
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

type ActiveTab = 'inbox' | 'chat' | 'call'

// ── Attachment Card ───────────────────────────────────────────────────────────

function AttachmentCard({ attachment, isUser }: { attachment: Attachment; isUser: boolean }) {
  const isImage = isImageType(attachment.type)

  if (isImage) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="attachment-image-link"
      >
        <img
          src={attachment.url}
          alt={attachment.name}
          className="attachment-image"
          loading="lazy"
        />
        <span className="attachment-image-name">{attachment.name}</span>
      </a>
    )
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`attachment-file-card ${isUser ? 'user' : ''}`}
    >
      <span className="attachment-file-icon">
        {attachment.type === 'application/pdf' ? '📄' :
          attachment.type.includes('word') ? '📝' :
          attachment.type.includes('excel') || attachment.type.includes('spreadsheet') ? '📊' :
          attachment.type.startsWith('audio') ? '🎵' :
          attachment.type.startsWith('video') ? '🎬' : '📎'}
      </span>
      <span className="attachment-file-info">
        <span className="attachment-file-name">{attachment.name}</span>
        <span className="attachment-file-size">{formatFileSize(attachment.size)}</span>
      </span>
      <span className="attachment-download-icon">↓</span>
    </a>
  )
}

// ── Pending Upload Preview ────────────────────────────────────────────────────

interface PendingFile {
  id: string
  file: File
  previewUrl?: string
  uploading: boolean
  uploaded?: Attachment
  error?: string
}

function PendingFilePreview({ pf, onRemove }: { pf: PendingFile; onRemove: () => void }) {
  const isImage = isImageType(pf.file.type)

  return (
    <div className={`pending-file ${pf.uploading ? 'uploading' : ''} ${pf.error ? 'error' : ''}`}>
      {isImage && pf.previewUrl ? (
        <img src={pf.previewUrl} alt={pf.file.name} className="pending-file-thumb" />
      ) : (
        <span className="pending-file-icon">📎</span>
      )}
      <span className="pending-file-name">{pf.file.name}</span>
      {pf.uploading && <span className="pending-file-spinner" />}
      {pf.error && <span className="pending-file-error">!</span>}
      {!pf.uploading && (
        <button onClick={onRemove} className="pending-file-remove">
          <XCircleIcon />
        </button>
      )}
    </div>
  )
}

// ── Main Widget ───────────────────────────────────────────────────────────────

export default function Widget({ config: staticConfig }: { config: WidgetConfig }) {
  const { config } = useWidgetConfig(staticConfig.orgId, staticConfig)

  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<ActiveTab>('inbox')
  const [input, setInput] = useState('')
  const [showNewChatConfirm, setShowNewChatConfirm] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [formError, setFormError] = useState('')
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const autoOpenDone = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    messages, conversations, activeConversation, activeConversationId,
    typing, connected, agentActive, visitorInfo,
    sendMessage, uploadFile, sendTyping, startNewChat, openConversation, refreshInbox, initWithVisitorInfo,
  } = useChat(config.orgId)

  // ── Vapi ──────────────────────────────────────────────────────────────────
  const vapiCallOptions = (config.voiceEnabled && config.vapiPublicKey && config.vapiAssistantId)
    ? {
        publicKey: config.vapiPublicKey,
        assistantId: config.vapiAssistantId,
        orgId: config.orgId,
        visitorName: visitorInfo?.name,
        visitorEmail: visitorInfo?.email,
      }
    : null

  const {
    callState, isMuted, volumeLevel, transcript: callTranscript,
    errorMessage: callError, callDurationSeconds, startCall, endCall, toggleMute,
  } = useVapiCall(vapiCallOptions)

  const isCallActive = callState === 'active' || callState === 'connecting' || callState === 'ending'

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Config values ─────────────────────────────────────────────────────────
  const color = config.primaryColor || '#6366f1'
  const userBubbleColor = config.userBubbleColor || color
  const launcherPx = LAUNCHER_PX[config.launcherSize || 'md'] ?? 56
  const borderRadius = config.borderRadius ?? 20
  const widgetWidth = config.widgetWidth ?? 380
  const headerStyle = config.headerStyle ?? 'gradient'
  const showTyping = config.showTypingIndicator !== false
  const botName = config.botName || 'AI Assistant'
  const inputPlaceholder = config.inputPlaceholder || 'Type a message…'
  const responseTimeText = config.responseTimeText || 'AI · We reply instantly'

  const isLeft = config.position === 'bottom-left' || config.position === 'top-left'
  const isTop = config.position === 'top-left' || config.position === 'top-right'
  const showPreChat = !visitorInfo

  const headerBg = headerStyle === 'gradient'
    ? `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`
    : color

  // ── Auto-open ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!config.autoOpen || autoOpenDone.current) return
    const delay = (config.autoOpenDelay ?? 5) * 1000
    const timer = setTimeout(() => {
      setOpen(true)
      autoOpenDone.current = true
    }, delay)
    return () => clearTimeout(timer)
  }, [config.autoOpen, config.autoOpenDelay])

  // ── Call ended → switch tab ───────────────────────────────────────────────
  useEffect(() => {
    if (callState === 'ended' || callState === 'error') {
      if (tab === 'call') setTimeout(() => setTab('chat'), 1500)
    }
  }, [callState, tab])

  // ── Scroll to bottom on new messages ─────────────────────────────────────
  useEffect(() => {
    if (open) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
    }
  }, [messages, typing, open])

  useEffect(() => {
    if (open && !showPreChat) refreshInbox()
  }, [open, showPreChat, refreshInbox])

  // ── Revoke object URLs ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      pendingFiles.forEach(pf => { if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl) })
    }
  }, [])

  // ── Dynamic styles ────────────────────────────────────────────────────────
  const dynamicStyles = `
    :host { --brand: ${color}; --brand-user: ${userBubbleColor}; --radius: ${borderRadius}px; }
    .launcher { width: ${launcherPx}px !important; height: ${launcherPx}px !important; }
    .window { width: ${widgetWidth}px !important; border-radius: var(--radius) !important; }
    .bubble.user { background: var(--brand-user) !important; }
    .tab-indicator { background: var(--brand); }
    .send-btn { background: var(--brand) !important; }
    .status-dot-active { background: #22c55e; }
    .prechat-submit { background: var(--brand) !important; }
    .inbox-start-btn { background: var(--brand) !important; }
    .call-start-btn { background: var(--brand) !important; }
    .call-control-active { background: #fee2e2; color: #dc2626; }
    .inbox-item.selected { border-color: var(--brand); }
    @media (max-width: 440px) {
      .window { width: calc(100vw - 20px) !important; }
    }
  `

  const tabCount = (config.voiceEnabled && config.vapiPublicKey && config.vapiAssistantId) ? 3 : 2

  // ── File handling ─────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const newPending: PendingFile[] = []

    for (const file of Array.from(files)) {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        console.warn(`[widget] File type not allowed: ${file.type}`)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`[widget] File too large: ${file.name}`)
        continue
      }

      const pf: PendingFile = {
        id: Math.random().toString(36).slice(2),
        file,
        uploading: false,
      }

      if (isImageType(file.type)) {
        pf.previewUrl = URL.createObjectURL(file)
      }

      newPending.push(pf)
    }

    if (newPending.length === 0) return

    // Mark as uploading
    const uploadingPending = newPending.map(pf => ({ ...pf, uploading: true }))
    setPendingFiles(prev => [...prev, ...uploadingPending])

    // Upload each file
    for (const pf of uploadingPending) {
      try {
        const attachment = await uploadFile(pf.file)
        setPendingFiles(prev => prev.map(p =>
          p.id === pf.id
            ? { ...p, uploading: false, uploaded: attachment }
            : p
        ))
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Upload failed'
        setPendingFiles(prev => prev.map(p =>
          p.id === pf.id
            ? { ...p, uploading: false, error: errMsg }
            : p
        ))
        console.error('[widget] Upload error:', err)
      }
    }
  }, [uploadFile])

  const removePendingFile = useCallback((id: string) => {
    setPendingFiles(prev => {
      const pf = prev.find(p => p.id === id)
      if (pf?.previewUrl) URL.revokeObjectURL(pf.previewUrl)
      return prev.filter(p => p.id !== id)
    })
  }, [])

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    if (!activeConversationId) return
    if (activeConversation?.status === 'resolved' || activeConversation?.status === 'closed') return

    const text = input.trim()
    const uploadedAttachments = pendingFiles
      .filter(pf => pf.uploaded && !pf.error)
      .map(pf => pf.uploaded!)

    if (!text && uploadedAttachments.length === 0) return

    // Still uploading
    if (pendingFiles.some(pf => pf.uploading)) return

    setInput('')
    setPendingFiles([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    sendMessage(text, uploadedAttachments)
    setTab('chat')
  }, [activeConversation?.status, activeConversationId, input, pendingFiles, sendMessage])

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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
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

  const statusDot = !connected
    ? '#f87171'
    : agentActive ? '#22c55e' : '#4ade80'

  const statusLabel = !connected
    ? (config.offlineMessage || 'Connecting…')
    : agentActive ? 'Agent is online'
    : isCallActive ? `🎙️ ${formatDuration(callDurationSeconds)}`
    : responseTimeText

  const isResolvedConversation = activeConversation?.status === 'resolved' || activeConversation?.status === 'closed'
  const isUploading = pendingFiles.some(pf => pf.uploading)
  const hasReadyFiles = pendingFiles.some(pf => pf.uploaded && !pf.error)
  const canSend = (input.trim().length > 0 || hasReadyFiles) && !isUploading && !!activeConversationId && !isResolvedConversation && connected

  const voiceEnabled = !!(config.voiceEnabled && config.vapiPublicKey && config.vapiAssistantId)

  return (
    <>
      <style>{STYLES}</style>
      <style>{dynamicStyles}</style>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ALLOWED_FILE_TYPES.join(',')}
        style={{ display: 'none' }}
        onChange={e => {
          void handleFileSelect(e.target.files)
          e.target.value = ''
        }}
      />

      {/* ── Chat Window ── */}
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
            <div className="header-name">{config.companyName || 'Support'}</div>
            <div className="header-status">
              <span className="status-dot" style={{ background: statusDot }} />
              {statusLabel}
            </div>
          </div>
          <div className="header-actions">
            {!showPreChat && (
              <button className="header-btn" onClick={() => setShowNewChatConfirm(true)} title="New conversation">
                <NewChatIcon />
              </button>
            )}
            <button className="header-btn close-btn" onClick={() => setOpen(false)}>
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* New Chat Confirm */}
        {showNewChatConfirm && (
          <div className="overlay">
            <div className="confirm-box">
              <p className="confirm-title">Start a new conversation?</p>
              <p className="confirm-sub">Your current chat history will be kept in Inbox.</p>
              <div className="confirm-actions">
                <button className="confirm-cancel" onClick={() => setShowNewChatConfirm(false)}>Cancel</button>
                <button className="confirm-ok" onClick={() => { startNewChat(); setShowNewChatConfirm(false) }}>
                  Start New
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Pre-chat Form ── */}
        {showPreChat ? (
          <div className="prechat">
            <div className="prechat-hero">
              <div className="prechat-emoji">👋</div>
              <h2 className="prechat-title">Hello there!</h2>
              <p className="prechat-desc">{config.welcomeMessage || 'Fill in your details to get started with support.'}</p>
            </div>
            <form className="prechat-form" onSubmit={handlePreChatSubmit}>
              <div className="prechat-field">
                <label>Your Name</label>
                <input
                  type="text"
                  placeholder="Ali Hassan"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="prechat-field">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="ali@example.com"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                />
              </div>
              {formError && <p className="prechat-error">{formError}</p>}
              <button type="submit" className="prechat-submit">
                Start Chatting →
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="tabs" style={{ gridTemplateColumns: `repeat(${tabCount}, 1fr)` }}>
              {(['inbox', 'chat'] as const).map(t => (
                <button
                  key={t}
                  className={`tab-btn ${tab === t ? 'active' : ''}`}
                  onClick={() => setTab(t)}
                >
                  {t === 'inbox' ? 'Inbox' : 'Chat'}
                  {tab === t && <span className="tab-indicator" />}
                </button>
              ))}
              {voiceEnabled && (
                <button
                  className={`tab-btn ${tab === 'call' ? 'active' : ''} ${isCallActive ? 'tab-call-live' : ''}`}
                  onClick={() => setTab('call')}
                >
                  {isCallActive ? `📞 ${formatDuration(callDurationSeconds)}` : '📞 Call'}
                  {tab === 'call' && <span className="tab-indicator" />}
                </button>
              )}
            </div>

            {/* ── Inbox Tab ── */}
            {tab === 'inbox' && (
              <div className="inbox-list">
                <div className="inbox-ctas">
                  <button className="inbox-start-btn" onClick={handleStartChat}>
                    💬 New Chat
                  </button>
                  {voiceEnabled && (
                    <button
                      className="inbox-call-btn"
                      onClick={isCallActive ? () => setTab('call') : handleStartCall}
                    >
                      <PhoneIcon />
                      {isCallActive ? `Live · ${formatDuration(callDurationSeconds)}` : (config.callButtonLabel || 'Talk to AI')}
                    </button>
                  )}
                  <button className="inbox-refresh-btn" onClick={refreshInbox}>↺</button>
                </div>

                {conversations.length === 0 ? (
                  <div className="inbox-empty">
                    <div className="inbox-empty-icon">💬</div>
                    <p className="inbox-empty-title">No conversations yet</p>
                    <p className="inbox-empty-sub">Start a chat and it'll appear here</p>
                  </div>
                ) : (
                  conversations.map(conversation => {
                    const selected = conversation.id === activeConversationId
                    const title = conversation.contactName || conversation.contactEmail || visitorInfo?.name || 'Conversation'
                    const preview = conversation.lastMessage || 'Start chatting…'

                    return (
                      <button
                        key={conversation.id}
                        className={`inbox-item ${selected ? 'selected' : ''}`}
                        onClick={() => { openConversation(conversation.id); setTab('chat') }}
                      >
                        <div className="inbox-item-header">
                          <span className="inbox-item-name">{title}</span>
                          <span className="inbox-item-time">{formatRelativeTimestamp(conversation.lastMessageAt)}</span>
                        </div>
                        <p className="inbox-item-preview">{preview}</p>
                        <span className={`inbox-badge status-${conversation.status}`}>{conversation.status}</span>
                      </button>
                    )
                  })
                )}
              </div>
            )}

            {/* ── Chat Tab ── */}
            {tab === 'chat' && (
              <>
                <div className="messages">
                  {!activeConversationId ? (
                    <div className="messages-empty">
                      <div className="messages-empty-icon">✨</div>
                      <p>Hi {visitorInfo?.name?.split(' ')[0]}! How can we help?</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="messages-empty">
                      <div className="messages-empty-icon">💬</div>
                      <p>Send your first message to begin</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isSystem = msg.content.startsWith('—') && msg.content.endsWith('—')
                      const prevMsg = messages[idx - 1]
                      const showDate = !prevMsg || msg.createdAt.getTime() - prevMsg.createdAt.getTime() > 5 * 60 * 1000
                      const isUser = msg.role === 'user'
                      const isAgent = msg.role === 'agent'

                      if (isSystem) {
                        return (
                          <div key={msg.id} className="system-msg">
                            <span>{msg.content}</span>
                          </div>
                        )
                      }

                      return (
                        <div key={msg.id}>
                          {showDate && (
                            <div className="time-divider">
                              <span>{formatDate(msg.createdAt)}</span>
                            </div>
                          )}
                          <div className={`msg-row ${isUser ? 'user' : ''}`}>
                            {!isUser && (
                              <div className="msg-avatar" style={{ background: `${color}18`, color }}>
                                {isAgent ? <AgentIcon /> : <BotIcon />}
                              </div>
                            )}
                            <div className={`msg-group ${isUser ? 'user' : ''}`}>
                              {msg.role === 'assistant' && (
                                <span className="msg-sender">{botName}</span>
                              )}
                              {msg.role === 'agent' && (
                                <span className="msg-sender agent">Support Agent</span>
                              )}

                              {/* Text bubble */}
                              {msg.content && (
                                <div
                                  className={`bubble ${isUser ? 'user' : isAgent ? 'agent' : 'bot'}`}
                                >
                                  {msg.content}
                                </div>
                              )}

                              {/* Attachments */}
                              {(msg.attachments ?? []).map((att, i) => (
                                <AttachmentCard key={i} attachment={att} isUser={isUser} />
                              ))}

                              <span className="msg-time">{formatTime(msg.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}

                  {/* Typing indicator */}
                  {showTyping && typing && activeConversationId && (
                    <div className="msg-row">
                      <div className="msg-avatar" style={{ background: `${color}18`, color }}>
                        <BotIcon />
                      </div>
                      <div className="typing-indicator">
                        <span /><span /><span />
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} style={{ height: 1 }} />
                </div>

                {/* Resolved notice */}
                {isResolvedConversation && (
                  <div className="resolved-notice">
                    ✅ This conversation has been resolved
                  </div>
                )}

                {/* Pending file previews */}
                {pendingFiles.length > 0 && (
                  <div className="pending-files">
                    {pendingFiles.map(pf => (
                      <PendingFilePreview
                        key={pf.id}
                        pf={pf}
                        onRemove={() => removePendingFile(pf.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Input area */}
                {!isResolvedConversation && (
                  <div className="input-area">
                    <div className="input-row">
                      <button
                        className="input-attach-btn"
                        onClick={() => fileInputRef.current?.click()}
                        title="Attach file"
                        disabled={!connected || !activeConversationId}
                      >
                        <AttachIcon />
                      </button>
                      <div className="input-wrap">
                        <textarea
                          ref={textareaRef}
                          rows={1}
                          placeholder={
                            !connected
                              ? (config.offlineMessage || 'Reconnecting…')
                              : !activeConversationId
                              ? 'Start a chat first…'
                              : inputPlaceholder
                          }
                          value={input}
                          onChange={handleInputChange}
                          onKeyDown={handleKey}
                          onBlur={() => sendTyping(false)}
                          disabled={!connected || !activeConversationId}
                        />
                      </div>
                      <button
                        className={`send-btn ${canSend ? 'active' : ''}`}
                        onClick={handleSend}
                        disabled={!canSend}
                        title="Send"
                      >
                        {isUploading ? <span className="send-spinner" /> : <SendIcon />}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Voice Call Tab ── */}
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
                callButtonLabel={config.callButtonLabel || 'Talk to AI'}
                onStartCall={handleStartCall}
                onEndCall={endCall}
                onToggleMute={toggleMute}
              />
            )}
          </>
        )}

        {/* Branding */}
        {config.showBranding !== false && (
          <div className="branding">
            Powered by <a href="https://tinfin.com" target="_blank" rel="noopener">Tinfin</a>
          </div>
        )}
      </div>

      {/* ── Launcher ── */}
      <button
        className={`launcher ${isLeft ? 'left' : ''} ${isTop ? 'top' : ''} ${isCallActive ? 'launcher-live' : ''}`}
        style={{ background: isCallActive ? '#16a34a' : headerBg }}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {isCallActive ? <PhoneIcon /> : open ? <CloseIcon /> : <ChatIcon />}
      </button>
    </>
  )
}

// ── Voice Call Panel ──────────────────────────────────────────────────────────

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

  const bars = 5
  const activeBarCount = Math.round(volumeLevel * bars)

  return (
    <div className="call-panel">
      {/* Avatar */}
      <div className="call-avatar-wrap">
        <div
          className={`call-avatar ${isActive ? 'pulsing' : ''}`}
          style={{ borderColor: isActive ? color : '#e5e7eb' }}
        >
          🤖
        </div>
        {isActive && (
          <div className="call-volume">
            {Array.from({ length: bars }, (_, i) => (
              <div
                key={i}
                className="call-bar"
                style={{
                  background: i < activeBarCount ? color : '#e5e7eb',
                  height: `${[8, 14, 20, 14, 8][i]}px`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="call-status">
        <p className="call-bot-name">{botName}</p>
        <p className="call-state-label">
          {callState === 'idle' && callButtonLabel}
          {callState === 'connecting' && '⏳ Connecting…'}
          {callState === 'active' && `🎙️ ${formatDuration(callDurationSeconds)}`}
          {callState === 'ending' && 'Ending call…'}
          {callState === 'ended' && '✅ Call ended'}
          {callState === 'error' && `❌ ${callError ?? 'Call failed'}`}
        </p>
      </div>

      {/* Transcript */}
      {callTranscript.length > 0 && (
        <div className="call-transcript">
          {callTranscript.slice(-4).map((entry, i) => (
            <div key={i} className={`transcript-entry ${entry.role}`}>
              <span className="transcript-role">{entry.role === 'user' ? 'You' : botName}</span>
              <span className="transcript-text">{entry.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="call-controls">
        {isIdle && (
          <button className="call-start-btn" onClick={onStartCall}>
            <PhoneIcon />
            {callState === 'error' ? 'Try Again' : callButtonLabel}
          </button>
        )}
        {(isActive || isConnecting) && (
          <>
            <button
              className={`call-ctrl-btn ${isMuted ? 'muted' : ''}`}
              onClick={onToggleMute}
              disabled={!isActive}
            >
              {isMuted ? <MicOffIcon /> : <MicIcon />}
              <span>{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>
            <button className="call-end-btn" onClick={onEndCall}>
              <PhoneOffIcon />
              <span>End</span>
            </button>
          </>
        )}
      </div>

      <p className="call-disclaimer">Calls may be recorded for quality purposes.</p>
    </div>
  )
}