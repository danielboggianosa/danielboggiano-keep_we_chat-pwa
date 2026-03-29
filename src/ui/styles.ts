/**
 * Global styles for the meeting transcription PWA.
 * Responsive design with mobile-first approach.
 */

export function injectStyles(): void {
  if (document.getElementById('app-styles')) return;

  const style = document.createElement('style');
  style.id = 'app-styles';
  style.textContent = `
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    :root {
      --color-primary: #1a73e8;
      --color-primary-dark: #1557b0;
      --color-danger: #d93025;
      --color-success: #1e8e3e;
      --color-bg: #f8f9fa;
      --color-surface: #ffffff;
      --color-text: #202124;
      --color-text-secondary: #5f6368;
      --color-border: #dadce0;
      --radius: 8px;
      --shadow: 0 1px 3px rgba(0,0,0,0.12);
      --nav-height: 56px;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--color-bg);
      color: var(--color-text);
      line-height: 1.5;
      min-height: 100vh;
    }

    #app {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .app-nav {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--color-primary);
      color: #fff;
      padding: 0 16px;
      height: var(--nav-height);
      position: sticky;
      top: 0;
      z-index: 100;
      overflow-x: auto;
    }

    .app-nav button {
      background: none;
      border: none;
      color: rgba(255,255,255,0.8);
      padding: 8px 12px;
      border-radius: var(--radius);
      cursor: pointer;
      font-size: 14px;
      white-space: nowrap;
    }

    .app-nav button.active,
    .app-nav button:hover {
      background: rgba(255,255,255,0.15);
      color: #fff;
    }

    .app-nav .nav-title {
      font-weight: 600;
      font-size: 16px;
      margin-right: 12px;
      white-space: nowrap;
    }

    .app-content {
      flex: 1;
      padding: 16px;
      max-width: 960px;
      width: 100%;
      margin: 0 auto;
    }

    .panel {
      background: var(--color-surface);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 20px;
      margin-bottom: 16px;
    }

    .panel h2 {
      font-size: 18px;
      margin-bottom: 12px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: none;
      border-radius: var(--radius);
      font-size: 14px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .btn-primary { background: var(--color-primary); color: #fff; }
    .btn-primary:hover { background: var(--color-primary-dark); }
    .btn-danger { background: var(--color-danger); color: #fff; }
    .btn-outline {
      background: none;
      border: 1px solid var(--color-border);
      color: var(--color-text);
    }
    .btn-outline:hover { background: var(--color-bg); }

    .recording-indicator {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 20px;
      background: var(--color-danger);
      color: #fff;
      font-size: 13px;
      font-weight: 500;
    }

    .recording-indicator .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #fff;
      animation: pulse 1.2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    .segment {
      padding: 8px 0;
      border-bottom: 1px solid var(--color-border);
    }

    .segment:last-child { border-bottom: none; }

    .segment-speaker {
      font-weight: 600;
      font-size: 13px;
      color: var(--color-primary);
    }

    .segment-time {
      font-size: 12px;
      color: var(--color-text-secondary);
      margin-left: 8px;
    }

    .segment-text {
      margin-top: 4px;
      font-size: 14px;
    }

    .search-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      font-size: 14px;
      outline: none;
    }

    .search-input:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px rgba(26,115,232,0.2);
    }

    .filters {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 8px;
    }

    .filters select, .filters input[type="date"] {
      padding: 6px 10px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      font-size: 13px;
    }

    .edit-history-item {
      padding: 8px;
      border-left: 3px solid var(--color-primary);
      margin-bottom: 8px;
      background: var(--color-bg);
      border-radius: 0 var(--radius) var(--radius) 0;
      font-size: 13px;
    }

    .minutes-section {
      margin-bottom: 16px;
    }

    .minutes-section h3 {
      font-size: 15px;
      margin-bottom: 6px;
      color: var(--color-text-secondary);
    }

    .minutes-section ul {
      padding-left: 20px;
    }

    .minutes-section li {
      margin-bottom: 4px;
      font-size: 14px;
    }

    textarea.minutes-editor {
      width: 100%;
      min-height: 200px;
      padding: 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      font-family: inherit;
      font-size: 14px;
      resize: vertical;
    }

    .export-options {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .export-option {
      padding: 12px 20px;
      border: 2px solid var(--color-border);
      border-radius: var(--radius);
      cursor: pointer;
      text-align: center;
      transition: border-color 0.15s;
    }

    .export-option:hover,
    .export-option.selected {
      border-color: var(--color-primary);
    }

    .export-option .format-name {
      font-weight: 600;
      font-size: 16px;
    }

    .export-option .format-desc {
      font-size: 12px;
      color: var(--color-text-secondary);
    }

    .hidden { display: none !important; }

    /* Responsive: tablet */
    @media (max-width: 768px) {
      .app-content { padding: 12px; }
      .panel { padding: 16px; }
      .filters { flex-direction: column; }
    }

    /* Responsive: mobile */
    @media (max-width: 480px) {
      .app-nav { padding: 0 8px; }
      .app-nav button { padding: 6px 8px; font-size: 13px; }
      .app-content { padding: 8px; }
      .panel { padding: 12px; }
      .export-options { flex-direction: column; }
    }
  `;
  document.head.appendChild(style);
}
