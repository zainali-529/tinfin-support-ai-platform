import { useState, useRef, useEffect, useCallback } from 'react'
import { useChat } from './useChat'
import { SendIcon, CloseIcon, ChatIcon, BotIcon } from './icons'
import { STYLES } from './styles'
import type { WidgetConfig } from './types'

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Widget({ config }: { config: WidgetConfig }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const { messages, typing, connected, sendMessage, sendTyping } = useChat(config.orgId)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const color = config.primaryColor || '#6366f1'
  const isLeft = config.position === 'bottom-left'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    sendMessage(text)
  }, [input, sendMessage])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 100) + 'px'
  }

  return (
    <>
      <style>{STYLES}</style>

      {/* Chat Window */}
      <div className={`window ${isLeft ? 'left' : ''} ${open ? '' : 'hidden'}`}>
        {/* Header */}
        <div className="header" style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}>
          <div className="header-avatar">
            {config.logoUrl
              ? <img src={config.logoUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              : '💬'
            }
          </div>
          <div className="header-info">
            <div className="header-name">{config.companyName || 'Support'}</div>
            <div className="header-status">
              <span className="status-dot" style={{ background: connected ? '#4ade80' : '#f87171' }} />
              {connected ? 'Online · We reply instantly' : 'Connecting...'}
            </div>
          </div>
          <button className="close-btn" onClick={() => setOpen(false)}>
            <CloseIcon />
          </button>
        </div>

        {/* Messages */}
        <div className="messages">
          {messages.length === 0 && (
            <div className="welcome">
              <div className="welcome-icon">👋</div>
              <div className="welcome-title">{config.welcomeMessage || 'Hi there!'}</div>
              <div className="welcome-sub">Ask us anything. We usually reply right away.</div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id}>
              <div className={`msg-row ${msg.role === 'user' ? 'user' : ''}`}>
                {msg.role !== 'user' && (
                  <div className="msg-avatar" style={{ background: `${color}22`, color }}>
                    <BotIcon />
                  </div>
                )}
                <div
                  className={`bubble ${msg.role === 'user' ? 'user' : 'bot'}`}
                  style={msg.role === 'user' ? { background: color } : {}}
                >
                  {msg.content}
                </div>
              </div>
              <div className={`msg-time ${msg.role === 'user' ? 'msg-row user' : 'msg-row'}`}>
                {formatTime(msg.createdAt)}
              </div>
            </div>
          ))}

          {typing && (
            <div className="msg-row">
              <div className="msg-avatar" style={{ background: `${color}22`, color }}>
                <BotIcon />
              </div>
              <div className="typing">
                <span /><span /><span />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer */}
        <div className="footer">
          <div className="input-wrap">
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Type a message..."
              value={input}
              onChange={handleInput}
              onKeyDown={handleKey}
              onInput={() => sendTyping(true)}
              onBlur={() => sendTyping(false)}
            />
          </div>
          <button
            className="send-btn"
            style={{ background: color }}
            onClick={handleSend}
            disabled={!input.trim() || typing}
          >
            <SendIcon />
          </button>
        </div>

        <div className="branding">
          Powered by <a href="https://tinfin.com" target="_blank" rel="noopener">Tinfin</a>
        </div>
      </div>

      {/* Launcher Button */}
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