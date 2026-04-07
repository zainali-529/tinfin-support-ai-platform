export const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :host { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

  .launcher {
    position: fixed; bottom: 24px; right: 24px;
    width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center; color: #fff;
    box-shadow: 0 4px 24px rgba(0,0,0,0.18);
    transition: transform 0.2s, box-shadow 0.2s; z-index: 999999;
  }
  .launcher:hover { transform: scale(1.08); box-shadow: 0 8px 32px rgba(0,0,0,0.22); }
  .launcher.left { right: auto; left: 24px; }
  .launcher.top { bottom: auto; top: 24px; }

  .window {
    position: fixed; bottom: 96px; right: 24px; width: 380px; height: 580px;
    border-radius: 20px; background: #fff;
    box-shadow: 0 8px 48px rgba(0,0,0,0.16);
    display: flex; flex-direction: column; overflow: hidden;
    z-index: 999998; transform-origin: bottom right;
    transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s;
  }
  .window.left { right: auto; left: 24px; transform-origin: bottom left; }
  .window.top { bottom: auto; top: 96px; transform-origin: top right; }
  .window.left.top { transform-origin: top left; }
  .window.hidden { transform: scale(0.85); opacity: 0; pointer-events: none; }

  /* ── Header ── */
  .header {
    padding: 14px 16px; display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  }
  .header-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    background: rgba(255,255,255,0.25);
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; flex-shrink: 0; color: #fff;
  }
  .header-info { flex: 1; min-width: 0; }
  .header-name { color: #fff; font-size: 15px; font-weight: 600; }
  .header-status {
    color: rgba(255,255,255,0.80); font-size: 12px; margin-top: 1px;
    display: flex; align-items: center; gap: 4px;
  }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .header-actions { display: flex; align-items: center; gap: 4px; }
  .header-btn, .close-btn {
    background: rgba(255,255,255,0.15); border: none; color: #fff;
    width: 30px; height: 30px; border-radius: 50%; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s; flex-shrink: 0;
  }
  .header-btn:hover, .close-btn:hover { background: rgba(255,255,255,0.28); }

  /* ── Tabs ── */
  .tabs {
    display: grid; grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid #f0f0f0; background: #fff;
  }
  .tab-btn {
    border: none; border-bottom: 2px solid transparent; background: transparent;
    padding: 11px 8px; font-size: 13px; font-weight: 600; color: #6b7280;
    cursor: pointer; transition: color 0.15s;
  }
  .tab-btn:hover { color: #111827; }
  .tab-btn.active { color: #111827; }

  /* ── Inbox ── */
  .inbox-list {
    flex: 1; overflow-y: auto; padding: 10px; background: #f8f9fb;
    display: flex; flex-direction: column; gap: 8px;
  }
  .inbox-top-actions {
    display: flex; align-items: center; gap: 8px; margin-bottom: 2px;
  }
  .inbox-start-btn {
    flex: 1; border: none; border-radius: 10px; color: #fff;
    padding: 10px 12px; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .inbox-start-btn:hover { opacity: 0.9; }
  .inbox-refresh-btn {
    border: 1px solid #e5e7eb; border-radius: 10px; background: #fff;
    color: #374151; padding: 10px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .inbox-refresh-btn:hover { background: #f9fafb; }

  .inbox-empty {
    text-align: center; padding: 40px 18px; color: #6b7280;
    background: #fff; border: 1px dashed #e5e7eb; border-radius: 12px;
  }

  .inbox-item {
    border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; cursor: pointer;
    text-align: left; padding: 10px 11px; display: flex; flex-direction: column; gap: 6px;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .inbox-item:hover { border-color: #d1d5db; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
  .inbox-item.selected { border-color: #9ca3af; }

  .inbox-item-row {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .inbox-item-title {
    font-size: 13px; font-weight: 700; color: #111827; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap;
  }
  .inbox-item-time {
    font-size: 11px; color: #9ca3af; flex-shrink: 0;
  }
  .inbox-item-preview {
    font-size: 12px; color: #6b7280; line-height: 1.35;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .inbox-item-meta { display: flex; }
  .inbox-status {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700;
    border-radius: 999px; padding: 3px 7px;
  }
  .status-bot { background: #dbeafe; color: #1d4ed8; }
  .status-pending { background: #fef3c7; color: #b45309; }
  .status-open { background: #d1fae5; color: #047857; }
  .status-resolved, .status-closed { background: #e5e7eb; color: #4b5563; }

  /* ── Pre-chat form ── */
  .prechat {
    flex: 1; overflow-y: auto; display: flex; flex-direction: column;
    padding: 24px 20px 20px; background: #f8f9fb; gap: 20px;
  }
  .prechat-welcome { text-align: center; }
  .prechat-icon { font-size: 40px; margin-bottom: 10px; }
  .prechat-welcome h2 { font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 6px; }
  .prechat-welcome p { font-size: 13px; color: #6b7280; line-height: 1.5; }
  .prechat-form { display: flex; flex-direction: column; gap: 12px; }
  .prechat-field { display: flex; flex-direction: column; gap: 5px; }
  .prechat-field label { font-size: 13px; font-weight: 600; color: #374151; }
  .prechat-field input {
    padding: 10px 12px; border: 1.5px solid #e5e7eb; border-radius: 10px;
    font-size: 14px; font-family: inherit; outline: none; background: #fff;
    transition: border-color 0.15s;
  }
  .prechat-field input:focus { border-color: currentColor; }
  .prechat-error { font-size: 12px; color: #ef4444; margin-top: -4px; }
  .prechat-submit {
    padding: 12px; border: none; border-radius: 12px; color: #fff;
    font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 4px;
    transition: opacity 0.15s;
  }
  .prechat-submit:hover { opacity: 0.88; }

  /* ── Confirm overlay ── */
  .confirm-overlay {
    position: absolute; inset: 0; background: rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: center; z-index: 10; padding: 20px;
  }
  .confirm-box {
    background: #fff; border-radius: 16px; padding: 20px; width: 100%; text-align: center;
    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  }
  .confirm-box > p { font-size: 15px; font-weight: 600; color: #111827; }
  .confirm-sub { font-size: 13px; color: #6b7280; margin-top: 4px; font-weight: 400; }
  .confirm-actions { display: flex; gap: 10px; margin-top: 16px; }
  .confirm-cancel {
    flex: 1; padding: 10px; border: 1px solid #e5e7eb; border-radius: 10px;
    background: #fff; color: #374151; font-size: 14px; cursor: pointer; font-weight: 500;
  }
  .confirm-cancel:hover { background: #f9fafb; }
  .confirm-ok {
    flex: 1; padding: 10px; border: none; border-radius: 10px;
    color: #fff; font-size: 14px; cursor: pointer; font-weight: 600; transition: opacity 0.15s;
  }
  .confirm-ok:hover { opacity: 0.88; }

  /* ── Messages ── */
  .messages {
    flex: 1; overflow-y: auto; padding: 14px 16px;
    display: flex; flex-direction: column; gap: 8px; background: #f8f9fb;
  }
  .messages::-webkit-scrollbar { width: 4px; }
  .messages::-webkit-scrollbar-thumb { background: #ddd; border-radius: 4px; }

  .welcome { text-align: center; padding: 20px 16px 8px; color: #6b7280; }
  .welcome-title { font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 4px; }
  .welcome-sub { font-size: 13px; line-height: 1.5; }

  .time-divider {
    display: flex; align-items: center; justify-content: center; margin: 4px 0;
  }
  .time-divider span { font-size: 11px; color: #9ca3af; padding: 0 8px; }

  .system-msg {
    text-align: center; font-size: 12px; color: #9ca3af; font-style: italic; padding: 4px 0;
  }

  .msg-row { display: flex; gap: 8px; align-items: flex-end; }
  .msg-row.user { flex-direction: row-reverse; }

  .msg-avatar {
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; flex-shrink: 0;
  }

  .bubble {
    max-width: 78%; padding: 10px 14px; border-radius: 18px;
    font-size: 14px; line-height: 1.5; word-break: break-word;
  }
  .bubble.user { border-bottom-right-radius: 4px; color: #fff; }
  .bubble.bot {
    background: #fff; color: #111827;
    border-bottom-left-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.07);
  }
  .bubble.agent { border-bottom-left-radius: 4px; color: #fff; }

  .typing {
    display: flex; align-items: center; gap: 4px; padding: 12px 14px;
    background: #fff; border-radius: 18px; border-bottom-left-radius: 4px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.07); width: fit-content;
  }
  .typing span {
    width: 7px; height: 7px; border-radius: 50%; background: #9ca3af;
    animation: bounce 1.2s infinite;
  }
  .typing span:nth-child(2) { animation-delay: 0.2s; }
  .typing span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }

  /* ── Footer ── */
  .footer {
    padding: 12px 16px; background: #fff; border-top: 1px solid #f0f0f0;
    display: flex; align-items: flex-end; gap: 8px; flex-shrink: 0;
  }
  .input-wrap {
    flex: 1; background: #f3f4f6; border-radius: 22px; padding: 10px 16px;
    display: flex; align-items: flex-end;
  }
  textarea {
    width: 100%; border: none; background: transparent; font-size: 14px;
    font-family: inherit; resize: none; outline: none; max-height: 100px;
    line-height: 1.5; color: #111827;
  }
  textarea::placeholder { color: #9ca3af; }
  .send-btn {
    width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center; color: #fff;
    transition: opacity 0.15s, transform 0.15s; flex-shrink: 0;
  }
  .send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .send-btn:not(:disabled):hover { opacity: 0.88; transform: scale(1.05); }

  .branding { text-align: center; padding: 7px; font-size: 11px; color: #d1d5db; flex-shrink: 0; }
  .branding a { color: inherit; text-decoration: none; }
  .branding a:hover { color: #9ca3af; }

  @media (max-width: 440px) {
    .window { width: calc(100vw - 16px); right: 8px; bottom: 88px; height: 72vh; }
    .window.left { left: 8px; right: auto; }
    .window.top { top: 88px; bottom: auto; }
    .launcher.top { top: 16px; bottom: auto; }
  }
`