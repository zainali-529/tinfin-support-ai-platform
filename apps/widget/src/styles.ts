export const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :host { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

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
    box-shadow: 0 4px 24px rgba(0,0,0,0.18);
    transition: transform 0.2s, box-shadow 0.2s;
    z-index: 999999;
  }
  .launcher:hover { transform: scale(1.08); box-shadow: 0 8px 32px rgba(0,0,0,0.22); }
  .launcher.left { right: auto; left: 24px; }

  .window {
    position: fixed;
    bottom: 96px;
    right: 24px;
    width: 380px;
    height: 560px;
    border-radius: 20px;
    background: #fff;
    box-shadow: 0 8px 48px rgba(0,0,0,0.16);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 999998;
    transform-origin: bottom right;
    transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s;
  }
  .window.left { right: auto; left: 24px; transform-origin: bottom left; }
  .window.hidden { transform: scale(0.85); opacity: 0; pointer-events: none; }

  .header {
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  .header-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255,255,255,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
  }
  .header-info { flex: 1; min-width: 0; }
  .header-name { color: #fff; font-size: 15px; font-weight: 600; }
  .header-status { color: rgba(255,255,255,0.75); font-size: 12px; margin-top: 1px; display: flex; align-items: center; gap: 4px; }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; }
  .close-btn {
    background: rgba(255,255,255,0.15);
    border: none;
    color: #fff;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
    flex-shrink: 0;
  }
  .close-btn:hover { background: rgba(255,255,255,0.25); }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: #f8f9fb;
    scroll-behavior: smooth;
  }
  .messages::-webkit-scrollbar { width: 4px; }
  .messages::-webkit-scrollbar-track { background: transparent; }
  .messages::-webkit-scrollbar-thumb { background: #ddd; border-radius: 4px; }

  .welcome {
    text-align: center;
    padding: 24px 16px;
    color: #6b7280;
  }
  .welcome-icon { font-size: 36px; margin-bottom: 8px; }
  .welcome-title { font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 4px; }
  .welcome-sub { font-size: 13px; line-height: 1.5; }

  .msg-row { display: flex; gap: 8px; align-items: flex-end; }
  .msg-row.user { flex-direction: row-reverse; }

  .msg-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    flex-shrink: 0;
  }

  .bubble {
    max-width: 75%;
    padding: 10px 14px;
    border-radius: 18px;
    font-size: 14px;
    line-height: 1.5;
    word-break: break-word;
  }
  .bubble.user { border-bottom-right-radius: 4px; color: #fff; }
  .bubble.bot { background: #fff; color: #111827; border-bottom-left-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }

  .msg-time { font-size: 11px; color: #9ca3af; margin-top: 4px; padding: 0 4px; }
  .msg-row.user .msg-time { text-align: right; }

  .typing { display: flex; align-items: center; gap: 4px; padding: 12px 14px; background: #fff; border-radius: 18px; border-bottom-left-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); width: fit-content; }
  .typing span { width: 7px; height: 7px; border-radius: 50%; background: #9ca3af; animation: bounce 1.2s infinite; }
  .typing span:nth-child(2) { animation-delay: 0.2s; }
  .typing span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }

  .footer {
    padding: 12px 16px;
    background: #fff;
    border-top: 1px solid #f0f0f0;
    display: flex;
    align-items: flex-end;
    gap: 8px;
    flex-shrink: 0;
  }
  .input-wrap { flex: 1; background: #f3f4f6; border-radius: 22px; padding: 10px 16px; display: flex; align-items: flex-end; }
  textarea {
    width: 100%;
    border: none;
    background: transparent;
    font-size: 14px;
    font-family: inherit;
    resize: none;
    outline: none;
    max-height: 100px;
    line-height: 1.5;
    color: #111827;
  }
  textarea::placeholder { color: #9ca3af; }
  .send-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.15s, transform 0.15s;
    flex-shrink: 0;
    color: #fff;
  }
  .send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
  .send-btn:not(:disabled):hover { opacity: 0.88; transform: scale(1.05); }

  .branding { text-align: center; padding: 8px; font-size: 11px; color: #d1d5db; }
  .branding a { color: inherit; text-decoration: none; }
  .branding a:hover { color: #9ca3af; }

  @media (max-width: 440px) {
    .window { width: calc(100vw - 16px); right: 8px; bottom: 88px; height: 70vh; }
    .window.left { left: 8px; right: auto; }
  }
`