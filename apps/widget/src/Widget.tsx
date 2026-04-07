import { useState, useRef, useEffect, useCallback } from 'react'
import { useChat } from './useChat'
import { SendIcon, CloseIcon, ChatIcon, BotIcon, AgentIcon, NewChatIcon } from './icons'
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

export default function Widget({ config }: { config: WidgetConfig }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [showNewChatConfirm, setShowNewChatConfirm] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [formError, setFormError] = useState('')

  const {
    messages, typing, connected, agentActive, visitorInfo,
    sendMessage, sendTyping, startNewChat, initWithVisitorInfo,
  } = useChat(config.orgId)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const color = config.primaryColor || '#6366f1'
  const isLeft = config.position === 'bottom-left'
  const showPreChat = !visitorInfo

  useEffect(() => {
    if (open) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
    }
  }, [messages, typing, open])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    sendMessage(text)
  }, [input, sendMessage])

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
    ? 'Connecting...'
    : agentActive ? 'Agent is online' : 'AI · We reply instantly'
  const statusColor = !connected ? '#f87171' : agentActive ? '#34d399' : '#4ade80'

  return (
    <>
      <style>{STYLES}</style>

      <div className={`window ${isLeft ? 'left' : ''} ${open ? '' : 'hidden'}`}>
        {/* Header */}
        <div className="header" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
          <div className="header-avatar">
            {config.logoUrl
              ? <img src={config.logoUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              : agentActive ? <AgentIcon /> : '💬'
            }
          </div>
          <div className="header-info">
            <div className="header-name">{config.companyName || 'Support'}</div>
            <div className="header-status">
              <span className="status-dot" style={{ background: statusColor }} />
              {statusText}
            </div>
          </div>
          <div className="header-actions">
            {!showPreChat && messages.length > 0 && (
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
                <input
                  type="text"
                  placeholder="e.g. Ali Hassan"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="prechat-field">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. ali@example.com"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                />
              </div>
              {formError && <p className="prechat-error">{formError}</p>}
              <button type="submit" className="prechat-submit" style={{ background: color }}>
                Start Chat →
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="messages">
              {messages.length === 0 && (
                <div className="welcome">
                  <div className="welcome-title">Hi {visitorInfo?.name?.split(' ')[0]}! 👋</div>
                  <div className="welcome-sub">Ask us anything. We usually reply right away.</div>
                </div>
              )}

              {messages.map((msg, idx) => {
                const isSystem = msg.content.startsWith('—') && msg.content.endsWith('—')
                const prevMsg = messages[idx - 1]
                const showDate = !prevMsg ||
                  msg.createdAt.getTime() - prevMsg.createdAt.getTime() > 5 * 60 * 1000

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
                        <div
                          className={`bubble ${msg.role === 'user' ? 'user' : msg.role === 'agent' ? 'agent' : 'bot'}`}
                          style={
                            msg.role === 'user' ? { background: color }
                            : msg.role === 'agent' ? { background: '#059669' }
                            : {}
                          }
                        >
                          {msg.content}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {typing && (
                <div className="msg-row">
                  <div className="msg-avatar" style={{ background: `${color}22`, color }}>
                    <BotIcon />
                  </div>
                  <div className="typing"><span /><span /><span /></div>
                </div>
              )}

              <div ref={messagesEndRef} style={{ height: 1 }} />
            </div>

            {/* Input Footer */}
            <div className="footer">
              <div className="input-wrap">
                <textarea
                  ref={textareaRef} rows={1}
                  placeholder={agentActive ? 'Message the agent...' : 'Type a message...'}
                  value={input}
                  onChange={handleInput}
                  onKeyDown={handleKey}
                  onBlur={() => sendTyping(false)}
                />
              </div>
              <button className="send-btn" style={{ background: color }}
                onClick={handleSend} disabled={!input.trim()}>
                <SendIcon />
              </button>
            </div>
          </>
        )}

        <div className="branding">
          Powered by <a href="https://tinfin.com" target="_blank" rel="noopener">Tinfin</a>
        </div>
      </div>

      {/* Launcher */}
      <button
        className={`launcher ${isLeft ? 'left' : ''}`}
        style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>
    </>
  )
}