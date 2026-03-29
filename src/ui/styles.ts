/**
 * Global styles matching the KeepWeChat Pencil design.
 * Design tokens from planning/001-keep-we-chat-design.pen
 */

export function injectStyles(): void {
  if (document.getElementById('app-styles')) return;

  const style = document.createElement('style');
  style.id = 'app-styles';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    :root {
      --accent-coral: #FF6B6B;
      --accent-coral-light: #FFF0F0;
      --accent-green: #22C55E;
      --accent-indigo: #6366F1;
      --accent-orange: #D97706;
      --accent-yellow: #FCD34D;
      --badge-green-bg: #F0FDF4;
      --badge-indigo-bg: #F0F5FF;
      --badge-yellow-bg: #FFFBEB;
      --bg-primary: #FFFFFF;
      --bg-surface: #F6F7F8;
      --border-default: #E5E7EB;
      --border-subtle: #F3F4F6;
      --text-primary: #1A1A1A;
      --text-secondary: #6B7280;
      --text-tertiary: #9CA3AF;
      --text-disabled: #D1D5DB;
      --font-display: 'Bricolage Grotesque', sans-serif;
      --font-body: 'DM Sans', sans-serif;
    }

    body {
      font-family: var(--font-body);
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.5;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    #app {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      max-width: 430px;
      margin: 0 auto;
      position: relative;
      overflow: hidden;
    }

    /* Screen container */
    .screen {
      display: none;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding-bottom: 76px;
    }
    .screen.active { display: flex; }

    /* Header */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
    }
    .header-title-wrap { display: flex; flex-direction: column; gap: 2px; }
    .header-greeting {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
    }
    .header-app-title {
      font-family: var(--font-display);
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary);
    }
    .header-icons { display: flex; align-items: center; gap: 16px; }
    .header-icons button {
      background: none; border: none; cursor: pointer; padding: 4px;
      color: var(--text-primary); display: flex;
    }

    /* Search bar */
    .search-bar { padding: 0 24px; }
    .search-inner {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 44px;
      padding: 0 16px;
      background: var(--bg-surface);
      border-radius: 22px;
      border: none;
      width: 100%;
      cursor: pointer;
    }
    .search-inner svg { color: var(--text-tertiary); flex-shrink: 0; }
    .search-inner span {
      font-size: 14px;
      color: var(--text-tertiary);
    }

    /* Stats row */
    .stats-row {
      display: flex;
      gap: 12px;
      padding: 16px 24px;
    }
    .stat-card {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 16px;
      background: var(--bg-surface);
      border-radius: 16px;
    }
    .stat-value {
      font-family: var(--font-display);
      font-size: 28px;
      font-weight: 800;
    }
    .stat-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
    }

    /* Section header */
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 24px 0 24px;
    }
    .section-title {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 700;
    }
    .section-link {
      font-size: 13px;
      font-weight: 600;
      color: var(--accent-coral);
      background: none; border: none; cursor: pointer;
    }

    /* Meeting cards */
    .meeting-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px 24px;
    }
    .meeting-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px;
      background: var(--bg-surface);
      border-radius: 16px;
      cursor: pointer;
      border: none;
      width: 100%;
      text-align: left;
    }
    .meeting-card-left {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .meeting-card-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
    }
    .meeting-card-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--text-secondary);
    }
    .meeting-card-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-green { background: var(--badge-green-bg); color: var(--accent-green); }
    .badge-yellow { background: var(--badge-yellow-bg); color: var(--accent-orange); }
    .badge-indigo { background: var(--badge-indigo-bg); color: var(--accent-indigo); }
    .meeting-card-arrow { color: var(--text-tertiary); flex-shrink: 0; }

    /* FAB */
    .fab-wrap {
      padding: 0 0 8px 0;
      display: flex;
      justify-content: center;
    }
    .fab {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 56px;
      padding: 0 24px;
      background: var(--accent-coral);
      color: #fff;
      border: none;
      border-radius: 28px;
      font-family: var(--font-body);
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(255,107,107,0.3);
    }
    .fab:active { transform: scale(0.97); }
    .fab svg { flex-shrink: 0; }

    /* Bottom nav */
    .nav-bar {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: 430px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 68px;
      padding: 12px 32px 20px 32px;
      background: var(--bg-primary);
      border-top: 1px solid var(--border-subtle);
      z-index: 100;
    }
    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
    }
    .nav-item svg { width: 22px; height: 22px; }
    .nav-item span {
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 500;
    }
    .nav-item.active svg { color: var(--accent-coral); }
    .nav-item.active span { color: var(--accent-coral); font-weight: 600; }
    .nav-item:not(.active) svg { color: var(--text-disabled); }
    .nav-item:not(.active) span { color: var(--text-disabled); }

    /* ===== Recording screen ===== */
    .rec-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
    }
    .rec-back {
      display: flex; align-items: center; gap: 6px;
      background: none; border: none; cursor: pointer;
      font-family: var(--font-body); font-size: 15px; font-weight: 500;
      color: var(--text-primary);
    }
    .rec-live-badge {
      display: flex; align-items: center; gap: 6px;
      padding: 4px 10px; border-radius: 12px;
      background: #FEE2E2;
    }
    .rec-live-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #EF4444;
      animation: pulse 1.2s ease-in-out infinite;
    }
    .rec-live-text {
      font-size: 11px; font-weight: 700; color: #EF4444;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    .rec-title-area {
      display: flex; flex-direction: column; gap: 4px;
      padding: 16px 24px;
    }
    .rec-title-text {
      font-family: var(--font-display);
      font-size: 24px; font-weight: 700;
    }
    .rec-subtitle {
      font-size: 13px; color: var(--text-secondary);
    }

    .rec-wave-area {
      flex: 1;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 24px;
    }
    .rec-timer {
      font-family: var(--font-display);
      font-size: 48px; font-weight: 800;
      color: var(--text-primary);
    }
    .rec-waveform {
      display: flex; align-items: center; gap: 3px; height: 60px;
    }
    .rec-waveform .bar {
      width: 4px; border-radius: 2px;
      background: var(--accent-coral);
      transition: height 0.15s ease;
    }
    .rec-speaker-info {
      display: flex; align-items: center; gap: 8px;
    }
    .rec-speaker-dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: var(--accent-green);
    }
    .rec-speaker-text {
      font-size: 13px; font-weight: 500; color: var(--text-secondary);
    }

    .rec-live-transcript {
      display: flex; flex-direction: column; gap: 12px;
      padding: 16px 24px;
    }
    .rec-lt-title {
      font-size: 13px; font-weight: 600; color: var(--text-tertiary);
    }
    .rec-lt-line {
      display: flex; gap: 10px;
    }
    .rec-lt-speaker {
      font-size: 14px; font-weight: 600; flex-shrink: 0;
    }
    .rec-lt-text {
      font-size: 14px; color: var(--text-primary);
    }

    .rec-controls {
      display: flex; align-items: center; justify-content: center;
      gap: 32px;
      padding: 16px 24px 32px 24px;
    }
    .rec-ctrl-btn {
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%; border: none; cursor: pointer;
    }
    .rec-ctrl-btn.secondary {
      width: 56px; height: 56px;
      background: var(--bg-surface);
      color: var(--text-primary);
    }
    .rec-ctrl-btn.stop {
      width: 72px; height: 72px;
      background: #EF4444;
      color: #fff;
    }
    .rec-ctrl-btn:active { transform: scale(0.93); }

    /* ===== Search screen ===== */
    .search-screen-header {
      padding: 16px 24px;
    }
    .search-screen-title {
      font-family: var(--font-display);
      font-size: 24px; font-weight: 700;
    }
    .search-input-wrap {
      padding: 8px 24px;
    }
    .search-input-inner {
      display: flex; align-items: center; gap: 10px;
      height: 44px; padding: 0 16px;
      background: var(--bg-surface);
      border-radius: 22px; width: 100%;
    }
    .search-input-inner input {
      flex: 1; border: none; background: none; outline: none;
      font-family: var(--font-body); font-size: 14px;
      color: var(--text-primary);
    }
    .search-input-inner input::placeholder { color: var(--text-tertiary); }
    .search-filters {
      display: flex; gap: 8px; padding: 8px 24px;
    }
    .filter-chip {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 14px; border-radius: 16px;
      font-size: 13px; font-weight: 500;
      border: none; cursor: pointer;
      font-family: var(--font-body);
    }
    .filter-chip.active {
      background: var(--accent-coral); color: #fff;
    }
    .filter-chip:not(.active) {
      background: var(--bg-surface); color: var(--text-secondary);
    }
    .search-result-count {
      padding: 12px 24px 4px 24px;
      font-size: 13px; font-weight: 500; color: var(--text-tertiary);
    }
    .search-results {
      display: flex; flex-direction: column; gap: 12px;
      padding: 8px 24px;
    }
    .search-result-card {
      display: flex; flex-direction: column; gap: 8px;
      padding: 16px; background: var(--bg-surface);
      border-radius: 16px;
    }
    .search-result-title {
      font-size: 15px; font-weight: 600; color: var(--text-primary);
    }
    .search-result-meta {
      font-size: 12px; color: var(--text-secondary);
    }
    .search-result-text {
      font-size: 14px; color: var(--text-primary);
    }
    .search-result-text mark {
      background: var(--accent-coral-light);
      color: var(--accent-coral);
      border-radius: 2px; padding: 0 2px;
    }

    /* ===== Transcription screen ===== */
    .trans-header {
      display: flex; align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
    }
    .trans-back {
      display: flex; align-items: center; gap: 6px;
      background: none; border: none; cursor: pointer;
      font-family: var(--font-body); font-size: 15px; font-weight: 500;
      color: var(--text-primary);
    }
    .trans-actions { display: flex; align-items: center; gap: 14px; }
    .trans-actions button {
      background: none; border: none; cursor: pointer;
      color: var(--text-primary); display: flex; padding: 4px;
    }
    .trans-title-area {
      display: flex; flex-direction: column; gap: 6px;
      padding: 8px 24px 16px 24px;
    }
    .trans-title {
      font-family: var(--font-display);
      font-size: 22px; font-weight: 700;
    }
    .trans-meta {
      display: flex; align-items: center; gap: 12px;
      font-size: 12px; color: var(--text-secondary);
    }
    .trans-speakers {
      display: flex; gap: 8px; padding: 0 24px;
    }
    .speaker-badge {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 12px; border-radius: 16px;
      font-size: 12px; font-weight: 600;
    }
    .trans-divider {
      height: 1px; background: var(--border-subtle);
      margin: 0;
    }
    .trans-content {
      display: flex; flex-direction: column; gap: 20px;
      padding: 16px 24px; flex: 1; overflow-y: auto;
    }
    .trans-segment {
      display: flex; flex-direction: column; gap: 4px;
    }
    .trans-seg-time {
      font-size: 11px; font-weight: 600; color: var(--text-tertiary);
    }
    .trans-seg-speaker {
      font-size: 13px; font-weight: 600;
    }
    .trans-seg-text {
      font-size: 14px; color: var(--text-primary); line-height: 1.5;
    }

    /* ===== Settings screen placeholder ===== */
    .settings-screen {
      padding: 24px;
    }
    .settings-title {
      font-family: var(--font-display);
      font-size: 24px; font-weight: 700;
      margin-bottom: 16px;
    }

    /* Utility */
    .hidden { display: none !important; }
    .spacer { flex: 1; }
  `;
  document.head.appendChild(style);
}
