/**
 * apps/widget/src/styles.ts
 *
 * Design Philosophy: "Premium Support Layer"
 * - Raleway font (geometric, elegant, professional)
 * - Refined minimal with intentional depth
 * - Smooth cubic-bezier transitions throughout
 * - Proper chat bubble design with subtle tails
 * - File attachment cards with clear hierarchy
 * - Voice panel with animated waveform bars
 */

export const STYLES = `
  /* ── Reset & Base ── */
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-font-smoothing: antialiased;
  }

  :host {
    font-family: 'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --brand: #6366f1;
    --brand-user: #6366f1;
    --radius: 20px;
    --shadow-sm: 0 1px 4px rgba(0,0,0,0.08);
    --shadow-md: 0 4px 20px rgba(0,0,0,0.12);
    --shadow-lg: 0 8px 40px rgba(0,0,0,0.16);
    --shadow-xl: 0 16px 64px rgba(0,0,0,0.20);
    --bg: #ffffff;
    --bg-subtle: #f8fafc;
    --bg-muted: #f1f5f9;
    --border: #e2e8f0;
    --border-strong: #cbd5e1;
    --text-primary: #0f172a;
    --text-secondary: #475569;
    --text-muted: #94a3b8;
    --green: #22c55e;
    --red: #ef4444;
    --amber: #f59e0b;
  }

  /* ── Launcher Button ── */
  .launcher {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    box-shadow: 0 4px 20px rgba(0,0,0,0.20), 0 1px 4px rgba(0,0,0,0.10);
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
                box-shadow 0.2s ease;
    z-index: 999999;
    outline: none;
  }

  .launcher:hover {
    transform: scale(1.08);
    box-shadow: 0 8px 32px rgba(0,0,0,0.24), 0 2px 8px rgba(0,0,0,0.12);
  }

  .launcher:active {
    transform: scale(0.96);
  }

  .launcher.left { right: auto; left: 24px; }

  .launcher.launcher-live {
    animation: launcher-pulse 2s ease infinite;
  }

  @keyframes launcher-pulse {
    0%   { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.4), 0 4px 20px rgba(0,0,0,0.20); }
    70%  { box-shadow: 0 0 0 12px rgba(22, 163, 74, 0), 0 4px 20px rgba(0,0,0,0.20); }
    100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0), 0 4px 20px rgba(0,0,0,0.20); }
  }

  /* ── Chat Window ── */
  .window {
    position: fixed;
    bottom: 96px;
    right: 24px;
    width: 380px;
    height: 580px;
    border-radius: var(--radius);
    background: var(--bg);
    box-shadow: var(--shadow-xl);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 999998;
    border: 1px solid var(--border);
    transform-origin: bottom right;
    transition: transform 0.28s cubic-bezier(0.34, 1.4, 0.64, 1),
                opacity 0.22s ease;
  }

  .window.left   { right: auto; left: 24px; transform-origin: bottom left; }

  .window.hidden {
    transform: scale(0.88) translateY(8px);
    opacity: 0;
    pointer-events: none;
  }

  @media (max-width: 440px) {
    .window {
      width: calc(100vw - 20px) !important;
      right: 10px !important;
      left: 10px !important;
      bottom: 90px;
    }
    .launcher { bottom: 16px; right: 16px; }
    .launcher.left { left: 16px; }
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    flex-shrink: 0;
    position: relative;
  }

  .header-avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: rgba(255,255,255,0.22);
    border: 1.5px solid rgba(255,255,255,0.30);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
    color: #fff;
    overflow: hidden;
  }

  .header-info {
    flex: 1;
    min-width: 0;
  }

  .header-name {
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .header-status {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 2px;
    color: rgba(255,255,255,0.82);
    font-size: 11.5px;
    font-weight: 500;
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 1.5px solid rgba(255,255,255,0.4);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .header-btn {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    border: none;
    background: rgba(255,255,255,0.15);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease;
    outline: none;
  }

  .header-btn:hover {
    background: rgba(255,255,255,0.28);
  }

  /* ── Tabs ── */
  .tabs {
    display: grid;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    flex-shrink: 0;
  }

  .tab-btn {
    position: relative;
    border: none;
    background: transparent;
    padding: 11px 8px;
    font-size: 12.5px;
    font-weight: 600;
    font-family: 'Raleway', sans-serif;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.15s ease;
    letter-spacing: 0.02em;
    outline: none;
  }

  .tab-btn:hover { color: var(--text-secondary); }
  .tab-btn.active { color: var(--text-primary); }

  .tab-indicator {
    position: absolute;
    bottom: -1px;
    left: 50%;
    transform: translateX(-50%);
    width: 70%;
    height: 2px;
    border-radius: 2px 2px 0 0;
    background: var(--brand);
    animation: tab-slide-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes tab-slide-in {
    from { width: 0; opacity: 0; }
    to { width: 70%; opacity: 1; }
  }

  .tab-call-live {
    color: #16a34a !important;
  }

  /* ── Overlay (confirm dialogs) ── */
  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.50);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    padding: 20px;
    animation: fade-in 0.15s ease;
  }

  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

  .confirm-box {
    background: var(--bg);
    border-radius: 16px;
    padding: 22px;
    width: 100%;
    text-align: center;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border);
    animation: scale-in 0.2s cubic-bezier(0.34, 1.4, 0.64, 1);
  }

  @keyframes scale-in { from { transform: scale(0.88); opacity: 0; } to { transform: scale(1); opacity: 1; } }

  .confirm-title {
    font-size: 14.5px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .confirm-sub {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 16px;
    line-height: 1.5;
  }

  .confirm-actions {
    display: flex;
    gap: 10px;
  }

  .confirm-cancel {
    flex: 1;
    padding: 10px;
    border: 1.5px solid var(--border);
    border-radius: 10px;
    background: var(--bg);
    color: var(--text-secondary);
    font-size: 13px;
    font-family: 'Raleway', sans-serif;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    outline: none;
  }

  .confirm-cancel:hover { background: var(--bg-muted); }

  .confirm-ok {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 10px;
    background: var(--brand);
    color: #fff;
    font-size: 13px;
    font-family: 'Raleway', sans-serif;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.15s;
    outline: none;
  }

  .confirm-ok:hover { opacity: 0.88; transform: translateY(-1px); }

  /* ── Pre-chat Form ── */
  .prechat {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding: 28px 22px 22px;
    background: var(--bg-subtle);
    gap: 24px;
  }

  .prechat-hero {
    text-align: center;
  }

  .prechat-emoji {
    font-size: 48px;
    margin-bottom: 12px;
    animation: wave 2s ease infinite;
    display: inline-block;
  }

  @keyframes wave {
    0%, 100% { transform: rotate(0deg); }
    25%  { transform: rotate(15deg); }
    75%  { transform: rotate(-5deg); }
  }

  .prechat-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 6px;
    letter-spacing: -0.01em;
  }

  .prechat-desc {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.55;
    max-width: 280px;
    margin: 0 auto;
  }

  .prechat-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .prechat-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .prechat-field label {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--text-secondary);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .prechat-field input {
    padding: 11px 14px;
    border: 1.5px solid var(--border);
    border-radius: 10px;
    font-size: 13.5px;
    font-family: 'Raleway', sans-serif;
    color: var(--text-primary);
    background: var(--bg);
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .prechat-field input:focus {
    border-color: var(--brand);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 15%, transparent);
  }

  .prechat-field input::placeholder { color: var(--text-muted); }

  .prechat-error {
    font-size: 11.5px;
    color: var(--red);
    font-weight: 600;
  }

  .prechat-submit {
    padding: 13px;
    border: none;
    border-radius: 12px;
    background: var(--brand);
    color: #fff;
    font-size: 14px;
    font-family: 'Raleway', sans-serif;
    font-weight: 700;
    letter-spacing: 0.01em;
    cursor: pointer;
    margin-top: 4px;
    transition: opacity 0.15s, transform 0.15s;
    outline: none;
  }

  .prechat-submit:hover {
    opacity: 0.90;
    transform: translateY(-1px);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--brand) 35%, transparent);
  }

  /* ── Inbox ── */
  .inbox-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    background: var(--bg-subtle);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .inbox-ctas {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .inbox-start-btn {
    flex: 1;
    padding: 10px 14px;
    border: none;
    border-radius: 10px;
    background: var(--brand);
    color: #fff;
    font-size: 13px;
    font-family: 'Raleway', sans-serif;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: opacity 0.15s, transform 0.15s;
    outline: none;
  }

  .inbox-start-btn:hover { opacity: 0.88; transform: translateY(-1px); }

  .inbox-call-btn {
    flex: 0 0 auto;
    padding: 10px 14px;
    border: none;
    border-radius: 10px;
    background: #059669;
    color: #fff;
    font-size: 13px;
    font-family: 'Raleway', sans-serif;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: opacity 0.15s;
    outline: none;
  }

  .inbox-call-btn:hover { opacity: 0.88; }

  .inbox-refresh-btn {
    width: 36px;
    height: 36px;
    border: 1.5px solid var(--border);
    border-radius: 10px;
    background: var(--bg);
    color: var(--text-secondary);
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
    outline: none;
    flex-shrink: 0;
  }

  .inbox-refresh-btn:hover { background: var(--bg-muted); }

  .inbox-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 16px;
    text-align: center;
    background: var(--bg);
    border: 1.5px dashed var(--border);
    border-radius: 14px;
    gap: 8px;
  }

  .inbox-empty-icon { font-size: 32px; opacity: 0.5; }

  .inbox-empty-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-secondary);
  }

  .inbox-empty-sub {
    font-size: 12px;
    color: var(--text-muted);
  }

  .inbox-item {
    width: 100%;
    text-align: left;
    padding: 11px 13px;
    background: var(--bg);
    border: 1.5px solid var(--border);
    border-radius: 12px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 5px;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
    outline: none;
  }

  .inbox-item:hover {
    border-color: var(--border-strong);
    box-shadow: var(--shadow-sm);
    transform: translateY(-1px);
  }

  .inbox-item.selected {
    border-color: var(--brand);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 10%, transparent);
  }

  .inbox-item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .inbox-item-name {
    font-size: 12.5px;
    font-weight: 700;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .inbox-item-time {
    font-size: 10.5px;
    color: var(--text-muted);
    flex-shrink: 0;
    font-weight: 500;
  }

  .inbox-item-preview {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .inbox-badge {
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
    border-radius: 999px;
    padding: 2.5px 8px;
    align-self: flex-start;
  }

  .status-bot     { background: #ede9fe; color: #6d28d9; }
  .status-pending { background: #fef3c7; color: #92400e; }
  .status-open    { background: #dcfce7; color: #166534; }
  .status-resolved, .status-closed { background: var(--bg-muted); color: var(--text-muted); }

  /* ── Messages Area ── */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px 14px;
    background: var(--bg-subtle);
    display: flex;
    flex-direction: column;
    gap: 4px;
    scroll-behavior: smooth;
  }

  .messages::-webkit-scrollbar { width: 4px; }
  .messages::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }

  .messages-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-align: center;
    padding: 32px 16px;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
  }

  .messages-empty-icon { font-size: 36px; margin-bottom: 4px; }

  .time-divider {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 10px 0 6px;
  }

  .time-divider span {
    font-size: 10.5px;
    color: var(--text-muted);
    font-weight: 600;
    background: var(--bg-subtle);
    padding: 2px 10px;
    border-radius: 20px;
    border: 1px solid var(--border);
  }

  .system-msg {
    display: flex;
    justify-content: center;
    padding: 6px 0;
  }

  .system-msg span {
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
    background: var(--border);
    padding: 3px 12px;
    border-radius: 20px;
    font-weight: 500;
  }

  /* ── Message Row ── */
  .msg-row {
    display: flex;
    align-items: flex-end;
    gap: 7px;
    margin-bottom: 2px;
  }

  .msg-row.user { flex-direction: row-reverse; }

  .msg-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 13px;
  }

  .msg-group {
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-width: 78%;
    min-width: 0;
  }

  .msg-group.user { align-items: flex-end; }

  .msg-sender {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--text-muted);
    padding: 0 2px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .msg-sender.agent { color: #059669; }

  .msg-time {
    font-size: 10px;
    color: var(--text-muted);
    padding: 0 2px;
    font-weight: 500;
  }

  /* ── Bubbles ── */
  .bubble {
    padding: 9px 13px;
    border-radius: 16px;
    font-size: 13.5px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    animation: bubble-in 0.2s cubic-bezier(0.34, 1.4, 0.64, 1);
  }

  @keyframes bubble-in {
    from { transform: scale(0.88) translateY(4px); opacity: 0; }
    to   { transform: scale(1) translateY(0); opacity: 1; }
  }

  .bubble.user {
    background: var(--brand-user);
    color: #fff;
    border-bottom-right-radius: 4px;
  }

  .bubble.bot {
    background: var(--bg);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-bottom-left-radius: 4px;
    box-shadow: var(--shadow-sm);
  }

  .bubble.agent {
    background: #059669;
    color: #fff;
    border-bottom-left-radius: 4px;
  }

  /* ── Attachment Cards ── */
  .attachment-image-link {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-decoration: none;
    border-radius: 12px;
    overflow: hidden;
    max-width: 200px;
    border: 1px solid var(--border);
    animation: bubble-in 0.2s cubic-bezier(0.34, 1.4, 0.64, 1);
  }

  .attachment-image {
    display: block;
    width: 100%;
    max-height: 180px;
    object-fit: cover;
    background: var(--bg-muted);
  }

  .attachment-image-name {
    font-size: 11px;
    color: var(--text-muted);
    padding: 4px 8px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: var(--bg);
  }

  .attachment-file-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--bg);
    text-decoration: none;
    max-width: 220px;
    transition: background 0.15s, transform 0.15s;
    box-shadow: var(--shadow-sm);
    animation: bubble-in 0.2s cubic-bezier(0.34, 1.4, 0.64, 1);
  }

  .attachment-file-card:hover {
    background: var(--bg-muted);
    transform: translateY(-1px);
  }

  .attachment-file-card.user {
    border-color: rgba(255,255,255,0.3);
    background: rgba(255,255,255,0.18);
  }

  .attachment-file-card.user:hover { background: rgba(255,255,255,0.28); }

  .attachment-file-icon { font-size: 22px; flex-shrink: 0; }

  .attachment-file-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .attachment-file-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .attachment-file-card.user .attachment-file-name { color: rgba(255,255,255,0.95); }

  .attachment-file-size {
    font-size: 10.5px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .attachment-file-card.user .attachment-file-size { color: rgba(255,255,255,0.65); }

  .attachment-download-icon {
    font-size: 14px;
    color: var(--text-muted);
    flex-shrink: 0;
    font-weight: 600;
  }

  .attachment-file-card.user .attachment-download-icon { color: rgba(255,255,255,0.7); }

  /* ── Typing Indicator ── */
  .typing-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 10px 14px;
    background: var(--bg);
    border-radius: 16px;
    border-bottom-left-radius: 4px;
    border: 1px solid var(--border);
    box-shadow: var(--shadow-sm);
    width: fit-content;
    animation: bubble-in 0.2s ease;
  }

  .typing-indicator span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-muted);
    animation: typing-bounce 1.4s ease infinite;
  }

  .typing-indicator span:nth-child(2) { animation-delay: 0.15s; }
  .typing-indicator span:nth-child(3) { animation-delay: 0.30s; }

  @keyframes typing-bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
    30%            { transform: translateY(-5px); opacity: 1; }
  }

  /* ── Resolved Notice ── */
  .resolved-notice {
    text-align: center;
    padding: 10px 16px;
    font-size: 11.5px;
    color: var(--text-muted);
    font-weight: 600;
    background: var(--bg-muted);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  /* ── Pending File Previews ── */
  .pending-files {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 14px 0;
    background: var(--bg);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .pending-file {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    background: var(--bg-muted);
    border: 1.5px solid var(--border);
    border-radius: 8px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-secondary);
    max-width: 160px;
    transition: border-color 0.15s;
  }

  .pending-file.uploading { border-color: var(--brand); opacity: 0.8; }
  .pending-file.error     { border-color: var(--red); }

  .pending-file-thumb {
    width: 28px;
    height: 28px;
    border-radius: 5px;
    object-fit: cover;
    flex-shrink: 0;
  }

  .pending-file-icon { font-size: 18px; flex-shrink: 0; }

  .pending-file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .pending-file-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--border);
    border-top-color: var(--brand);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .pending-file-error {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--red);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .pending-file-remove {
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    padding: 0;
    transition: color 0.15s;
    flex-shrink: 0;
    outline: none;
  }

  .pending-file-remove:hover { color: var(--red); }

  /* ── Input Area ── */
  .input-area {
    padding: 10px 12px;
    background: var(--bg);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .quick-suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }

  .quick-suggestion-btn {
    border: 1.5px solid var(--border);
    background: var(--bg);
    color: var(--text-secondary);
    font-size: 11.5px;
    font-weight: 600;
    padding: 6px 10px;
    border-radius: 999px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s, transform 0.15s;
    outline: none;
  }

  .quick-suggestion-btn:hover:not(:disabled) {
    border-color: var(--brand);
    color: var(--brand);
    background: color-mix(in srgb, var(--brand) 7%, transparent);
    transform: translateY(-1px);
  }

  .quick-suggestion-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .input-attach-btn {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    border: 1.5px solid var(--border);
    background: var(--bg);
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
    outline: none;
    align-self: flex-end;
    margin-bottom: 1px;
  }

  .input-attach-btn:hover:not(:disabled) {
    border-color: var(--brand);
    background: color-mix(in srgb, var(--brand) 6%, transparent);
    color: var(--brand);
  }

  .input-attach-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .input-wrap {
    flex: 1;
    background: var(--bg-subtle);
    border: 1.5px solid var(--border);
    border-radius: 12px;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .input-wrap:focus-within {
    border-color: var(--brand);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 12%, transparent);
  }

  textarea {
    width: 100%;
    padding: 9px 12px;
    border: none;
    background: transparent;
    font-size: 13.5px;
    font-family: 'Raleway', sans-serif;
    color: var(--text-primary);
    resize: none;
    outline: none;
    max-height: 120px;
    line-height: 1.5;
    display: block;
    border-radius: 12px;
  }

  textarea::placeholder { color: var(--text-muted); }

  textarea:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .send-btn {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    border: none;
    background: var(--bg-muted);
    color: var(--text-muted);
    cursor: not-allowed;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, color 0.2s, transform 0.15s;
    flex-shrink: 0;
    outline: none;
    align-self: flex-end;
    margin-bottom: 1px;
  }

  .send-btn.active {
    background: var(--brand);
    color: #fff;
    cursor: pointer;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--brand) 40%, transparent);
  }

  .send-btn.active:hover {
    transform: scale(1.08) translateY(-1px);
    box-shadow: 0 4px 14px color-mix(in srgb, var(--brand) 50%, transparent);
  }

  .send-btn.active:active { transform: scale(0.96); }

  .talk-human-btn {
    margin-top: 8px;
    width: 100%;
    border: 1.5px solid var(--brand);
    background: color-mix(in srgb, var(--brand) 9%, transparent);
    color: var(--brand);
    font-size: 12px;
    font-weight: 700;
    padding: 8px 10px;
    border-radius: 12px;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
    outline: none;
  }

  .talk-human-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px color-mix(in srgb, var(--brand) 35%, transparent);
  }

  .talk-human-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .send-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  /* ── Voice Call Panel ── */
  .call-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 22px;
    padding: 28px 24px;
    background: var(--bg-subtle);
    overflow-y: auto;
  }

  .call-avatar-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }

  .call-avatar {
    width: 88px;
    height: 88px;
    border-radius: 50%;
    border: 3px solid var(--border);
    background: var(--bg-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    transition: border-color 0.3s, transform 0.3s;
  }

  .call-avatar.pulsing {
    animation: avatar-pulse 2.2s ease-in-out infinite;
    border-color: var(--brand);
  }

  @keyframes avatar-pulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 color-mix(in srgb, var(--brand) 30%, transparent); }
    50%       { transform: scale(1.05); box-shadow: 0 0 0 16px color-mix(in srgb, var(--brand) 0%, transparent); }
  }

  .call-volume {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 22px;
  }

  .call-bar {
    width: 4px;
    border-radius: 2px;
    transition: background 0.08s, height 0.15s;
  }

  .call-status {
    text-align: center;
  }

  .call-bot-name {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
    margin-bottom: 5px;
  }

  .call-state-label {
    font-size: 13.5px;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .call-transcript {
    width: 100%;
    background: var(--bg);
    border: 1.5px solid var(--border);
    border-radius: 14px;
    padding: 12px;
    max-height: 130px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .transcript-entry { display: flex; flex-direction: column; gap: 2px; }

  .transcript-role {
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-muted);
  }

  .transcript-entry.user .transcript-role { color: var(--brand); }

  .transcript-text {
    font-size: 12.5px;
    color: var(--text-secondary);
    line-height: 1.45;
  }

  .call-controls {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: center;
  }

  .call-start-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 32px;
    border: none;
    border-radius: 999px;
    background: var(--brand);
    color: #fff;
    font-size: 14px;
    font-family: 'Raleway', sans-serif;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.15s, opacity 0.15s, box-shadow 0.15s;
    box-shadow: 0 4px 16px color-mix(in srgb, var(--brand) 40%, transparent);
    outline: none;
  }

  .call-start-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 22px color-mix(in srgb, var(--brand) 50%, transparent);
  }

  .call-ctrl-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 18px;
    border: 1.5px solid var(--border);
    border-radius: 14px;
    background: var(--bg);
    color: var(--text-secondary);
    font-size: 11px;
    font-family: 'Raleway', sans-serif;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    min-width: 70px;
    outline: none;
  }

  .call-ctrl-btn:hover:not(:disabled) { background: var(--bg-muted); }
  .call-ctrl-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .call-ctrl-btn.muted {
    background: #fee2e2;
    border-color: #fca5a5;
    color: var(--red);
  }

  .call-end-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 18px;
    border: none;
    border-radius: 14px;
    background: var(--red);
    color: #fff;
    font-size: 11px;
    font-family: 'Raleway', sans-serif;
    font-weight: 700;
    cursor: pointer;
    min-width: 70px;
    transition: opacity 0.15s, transform 0.15s;
    outline: none;
  }

  .call-end-btn:hover {
    opacity: 0.88;
    transform: translateY(-1px);
  }

  .call-disclaimer {
    font-size: 10.5px;
    color: var(--text-muted);
    text-align: center;
    line-height: 1.4;
    font-weight: 500;
  }

  /* ── Branding ── */
  .branding {
    text-align: center;
    padding: 7px;
    font-size: 10.5px;
    color: var(--text-muted);
    flex-shrink: 0;
    font-weight: 500;
    border-top: 1px solid var(--border);
    background: var(--bg);
    letter-spacing: 0.01em;
  }

  .branding a {
    color: inherit;
    text-decoration: none;
    font-weight: 700;
  }

  .branding a:hover { color: var(--text-secondary); }

  /* ── Scrollbar global ── */
  * {
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
  }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }

  /* Advanced minimal shell overrides */
  .window,
  .launcher,
  .confirm-box,
  .inbox-item,
  .bubble,
  .attachment-file-card,
  .typing-indicator,
  .send-btn,
  .talk-human-chip,
  .quick-suggestion-btn,
  .call-start-btn {
    box-shadow: none !important;
  }

  .launcher {
    border: 1px solid rgba(255,255,255,0.24);
  }

  .launcher:hover {
    transform: translateY(-1px);
    box-shadow: none !important;
  }

  .window {
    bottom: 90px;
    border: 1px solid var(--border);
    background: var(--bg);
    transition:
      width 0.32s cubic-bezier(0.22, 1, 0.36, 1),
      height 0.32s cubic-bezier(0.22, 1, 0.36, 1),
      border-radius 0.24s ease,
      transform 0.28s cubic-bezier(0.34, 1.4, 0.64, 1),
      opacity 0.22s ease;
    will-change: width, height, transform;
  }

  .window.left {
    right: auto !important;
    left: 24px !important;
  }

  .window.hidden {
    transform: translateY(8px) scale(0.98);
  }

  .header {
    min-height: 64px;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.16);
  }

  .header-name,
  .header-status,
  .header-btn {
    color: var(--header-text);
  }

  .header-avatar {
    width: 34px;
    height: 34px;
    font-size: 16px;
  }

  .header-btn {
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.16);
  }

  .header-btn:hover {
    background: rgba(255,255,255,0.2);
  }

  .inbox-list,
  .messages,
  .call-panel,
  .help-panel,
  .prechat {
    background: var(--bg-subtle);
  }

  .inbox-start-btn,
  .inbox-call-btn,
  .inbox-refresh-btn,
  .prechat-submit,
  .confirm-cancel,
  .confirm-ok,
  .input-attach-btn,
  .send-btn,
  .call-ctrl-btn,
  .call-end-btn {
    box-shadow: none !important;
  }

  .messages {
    padding: 14px 12px;
    gap: 6px;
  }

  .chat-page {
    flex: 1;
    min-height: 0;
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--bg-subtle);
  }

  .chat-topbar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
  }

  .chat-back-btn {
    width: 32px;
    height: 32px;
    border: 1px solid var(--border);
    border-radius: 11px;
    background: var(--bg-muted);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }

  .chat-back-btn:hover {
    border-color: var(--brand);
    color: var(--brand);
    background: color-mix(in srgb, var(--brand) 8%, var(--bg));
  }

  .chat-topbar-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .chat-topbar-title {
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 800;
    line-height: 1.15;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chat-topbar-subtitle {
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 650;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chat-page .messages {
    min-height: 0;
    padding-bottom: 58px;
  }

  .msg-group {
    max-width: 74%;
  }

  .bubble {
    padding: 8px 11px;
    border-radius: 14px;
    font-size: 13px;
    line-height: 1.45;
  }

  .bubble.user {
    color: var(--brand-user-text);
  }

  .bubble.bot {
    border: 1px solid var(--border);
  }

  .suggestions-row {
    align-items: flex-start;
    margin-top: 2px;
  }

  .suggestions-card {
    max-width: 78%;
    background: var(--assistant-bg);
    color: var(--assistant-text);
    border: 1px solid var(--border);
    border-radius: 14px 14px 14px 4px;
    padding: 9px;
  }

  .suggestions-title {
    display: block;
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: 7px;
  }

  .inline-suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .inline-suggestion-btn {
    border: 1px solid color-mix(in srgb, var(--brand) 34%, var(--border));
    background: color-mix(in srgb, var(--brand) 7%, var(--bg));
    color: var(--brand);
    font: inherit;
    font-size: 11.5px;
    font-weight: 750;
    line-height: 1.2;
    padding: 6px 9px;
    border-radius: 999px;
    cursor: pointer;
    outline: none;
    transition: background 0.15s, border-color 0.15s, opacity 0.15s;
  }

  .inline-suggestion-btn:hover:not(:disabled) {
    border-color: var(--brand);
    background: color-mix(in srgb, var(--brand) 12%, var(--bg));
  }

  .inline-suggestion-btn:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .msg-avatar {
    width: 24px;
    height: 24px;
  }

  .input-area {
    padding: 10px 12px 12px;
    border-top: 1px solid var(--border);
  }

  .quick-actions-row {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 8px;
  }

  .quick-actions-row::-webkit-scrollbar {
    display: none;
  }

  .quick-suggestion-btn,
  .talk-human-chip {
    flex: 0 0 auto;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text-secondary);
    font-size: 11.5px;
    font-weight: 650;
    padding: 6px 10px;
    border-radius: 999px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    outline: none;
  }

  .talk-human-chip {
    border-color: color-mix(in srgb, var(--brand) 45%, var(--border));
    color: var(--brand);
    background: color-mix(in srgb, var(--brand) 8%, var(--bg));
  }

  .quick-suggestion-btn:hover:not(:disabled),
  .talk-human-chip:hover:not(:disabled) {
    border-color: var(--brand);
    color: var(--brand);
    background: color-mix(in srgb, var(--brand) 8%, var(--bg));
    transform: none;
  }

  .talk-human-btn {
    display: none;
  }

  .floating-human-btn {
    position: absolute;
    right: 12px;
    bottom: 74px;
    z-index: 4;
    border: 1px solid color-mix(in srgb, var(--brand) 45%, var(--border));
    background: var(--bg);
    color: var(--brand);
    border-radius: 999px;
    padding: 8px 12px;
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: none !important;
    outline: none;
    transition: background 0.15s, border-color 0.15s, transform 0.15s, opacity 0.15s;
  }

  .floating-human-btn:hover:not(:disabled) {
    border-color: var(--brand);
    background: color-mix(in srgb, var(--brand) 8%, var(--bg));
    transform: translateY(-1px);
  }

  .floating-human-btn:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .input-row {
    align-items: center;
  }

  .input-wrap {
    background: var(--bg-muted);
    border: 1px solid var(--border);
    border-radius: 14px;
  }

  .input-wrap:focus-within {
    border-color: var(--brand);
    box-shadow: none;
  }

  textarea {
    font-size: 13px;
    padding: 9px 11px;
  }

  .send-btn,
  .input-attach-btn {
    border-radius: 12px;
  }

  .send-btn {
    background: var(--bg-muted);
    color: var(--text-muted);
  }

  .bottom-nav {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 4px;
    padding: 8px;
    background: var(--bg);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .bottom-nav-btn {
    border: none;
    background: transparent;
    color: var(--text-muted);
    border-radius: 12px;
    min-height: 44px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    font: inherit;
    font-size: 10.5px;
    font-weight: 700;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    outline: none;
  }

  .bottom-nav-btn svg {
    width: 16px;
    height: 16px;
  }

  .bottom-nav-btn:hover,
  .bottom-nav-btn.active {
    background: color-mix(in srgb, var(--brand) 9%, var(--bg));
  }

  .bottom-nav-btn.live {
    color: #16a34a;
  }

  .help-panel {
    flex: 1;
    overflow-y: auto;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .help-intro {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 14px;
  }

  .help-kicker {
    color: var(--brand);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  .help-intro h3 {
    color: var(--text-primary);
    font-size: 16px;
    line-height: 1.2;
    margin-bottom: 5px;
  }

  .help-intro p {
    color: var(--text-secondary);
    font-size: 12.5px;
    line-height: 1.5;
  }

  .help-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .help-item {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 0;
    overflow: hidden;
  }

  .help-item summary {
    color: var(--text-primary);
    cursor: pointer;
    list-style: none;
    padding: 12px 13px;
    font-size: 13px;
    font-weight: 750;
  }

  .help-item summary::-webkit-details-marker {
    display: none;
  }

  .help-item p {
    border-top: 1px solid var(--border);
    color: var(--text-secondary);
    font-size: 12.5px;
    line-height: 1.55;
    padding: 12px 13px;
  }

  .help-action {
    margin: 0 13px 13px;
    border: 1px solid var(--brand);
    color: var(--brand);
    background: transparent;
    border-radius: 10px;
    padding: 7px 10px;
    font-size: 12px;
    font-weight: 750;
    cursor: pointer;
  }

  .help-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--text-muted);
    font-size: 12px;
    text-align: center;
  }

  @media (max-width: 440px) {
    .window,
    .window.left {
      left: 10px !important;
      right: 10px !important;
      bottom: 84px;
    }

    .launcher.left {
      left: 16px !important;
      right: auto !important;
    }
  }

  /* Professional voice call screen */
  .call-panel {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    gap: 0;
    padding: 0;
    background: var(--bg-subtle);
    overflow: hidden;
  }

  .call-topbar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
  }

  .call-back-btn {
    width: 32px;
    height: 32px;
    border: 1px solid var(--border);
    border-radius: 11px;
    background: var(--bg-muted);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }

  .call-back-btn:hover {
    border-color: var(--brand);
    color: var(--brand);
    background: color-mix(in srgb, var(--brand) 8%, var(--bg));
  }

  .call-topbar-copy {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .call-topbar-title {
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 850;
    line-height: 1.15;
  }

  .call-topbar-subtitle {
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 650;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .call-status-pill {
    flex-shrink: 0;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--bg-muted);
    color: var(--text-secondary);
    padding: 5px 8px;
    font-size: 10.5px;
    font-weight: 800;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .call-status-pill.state-active {
    border-color: color-mix(in srgb, #16a34a 45%, var(--border));
    background: color-mix(in srgb, #16a34a 10%, var(--bg));
    color: #15803d;
  }

  .call-status-pill.state-error {
    border-color: color-mix(in srgb, var(--red) 45%, var(--border));
    background: color-mix(in srgb, var(--red) 9%, var(--bg));
    color: var(--red);
  }

  .call-main {
    flex-shrink: 0;
    padding: 18px 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .call-identity {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .call-avatar {
    width: 58px;
    height: 58px;
    border-radius: 18px;
    border: 1px solid var(--border);
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--brand) 13%, var(--bg)), var(--bg));
    color: var(--brand);
    font-size: 17px;
    font-weight: 900;
    letter-spacing: -0.04em;
    box-shadow: none !important;
  }

  .call-avatar span {
    transform: translateY(1px);
  }

  .call-avatar.pulsing {
    animation: call-card-pulse 2.4s ease-in-out infinite;
  }

  @keyframes call-card-pulse {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-1px); }
  }

  .call-status {
    min-width: 0;
    text-align: left;
  }

  .call-bot-name {
    color: var(--text-primary);
    font-size: 17px;
    font-weight: 850;
    line-height: 1.15;
    margin: 0 0 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .call-state-label {
    color: var(--text-secondary);
    font-size: 12.5px;
    font-weight: 650;
    line-height: 1.35;
  }

  .call-waveform {
    min-height: 64px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 12px;
  }

  .call-waveform span {
    width: 5px;
    min-height: 8px;
    border-radius: 999px;
    background: var(--border-strong);
    transition: height 0.12s ease, background 0.12s ease, opacity 0.12s ease;
    opacity: 0.75;
  }

  .call-waveform.listening span {
    animation: voice-bar 1.05s ease-in-out infinite;
  }

  .call-waveform span.active {
    opacity: 1;
  }

  @keyframes voice-bar {
    0%, 100% { transform: scaleY(0.82); }
    50% { transform: scaleY(1.08); }
  }

  .call-metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .call-metrics div {
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--bg);
    padding: 9px 10px;
    min-width: 0;
  }

  .call-metrics span {
    display: block;
    color: var(--text-muted);
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  .call-metrics strong {
    display: block;
    color: var(--text-primary);
    font-size: 12px;
    font-weight: 850;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .call-transcript {
    flex: 1;
    min-height: 150px;
    max-height: none;
    margin: 0 12px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: var(--bg);
    padding: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .call-transcript-head {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }

  .call-transcript-head span {
    color: var(--text-primary);
    font-size: 12px;
    font-weight: 850;
  }

  .call-transcript-head small {
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 750;
  }

  .call-transcript-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .call-transcript-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    color: var(--text-muted);
    text-align: center;
    font-size: 12px;
    font-weight: 650;
    line-height: 1.45;
  }

  .transcript-entry {
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg-subtle);
    padding: 9px 10px;
  }

  .transcript-entry.user {
    background: color-mix(in srgb, var(--brand) 7%, var(--bg));
    border-color: color-mix(in srgb, var(--brand) 24%, var(--border));
  }

  .transcript-role {
    color: var(--text-muted);
    font-size: 9.5px;
    font-weight: 850;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .transcript-entry.user .transcript-role {
    color: var(--brand);
  }

  .transcript-text {
    color: var(--text-secondary);
    font-size: 12.5px;
    line-height: 1.5;
  }

  .call-controls {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px 12px 10px;
  }

  .call-start-btn {
    min-width: 0;
    width: 100%;
    justify-content: center;
    border-radius: 14px;
    padding: 12px 16px;
    box-shadow: none !important;
  }

  .call-ctrl-btn,
  .call-end-btn {
    flex: 1;
    min-width: 0;
    min-height: 48px;
    border-radius: 14px;
    box-shadow: none !important;
  }

  .call-ctrl-btn {
    background: var(--bg);
  }

  .call-end-btn {
    background: #dc2626;
  }

  .call-disclaimer {
    flex-shrink: 0;
    padding: 0 14px 12px;
    margin: 0;
    color: var(--text-muted);
    font-size: 10.5px;
    font-weight: 600;
    line-height: 1.35;
    text-align: center;
  }

  @media (max-height: 640px) {
    .call-main {
      padding-top: 12px;
      padding-bottom: 10px;
      gap: 10px;
    }

    .call-waveform {
      min-height: 52px;
    }

    .call-metrics {
      display: none;
    }
  }
`
