(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))a(n);new MutationObserver(n=>{for(const r of n)if(r.type==="childList")for(const s of r.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&a(s)}).observe(document,{childList:!0,subtree:!0});function t(n){const r={};return n.integrity&&(r.integrity=n.integrity),n.referrerPolicy&&(r.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?r.credentials="include":n.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function a(n){if(n.ep)return;n.ep=!0;const r=t(n);fetch(n.href,r)}})();async function q(){if(!("serviceWorker"in navigator)){console.warn("Service Workers not supported in this browser.");return}try{const i=await navigator.serviceWorker.register("/sw.js",{scope:"/"});return console.log("Service Worker registered with scope:",i.scope),i}catch(i){console.error("Service Worker registration failed:",i);return}}const _="meeting-transcription-db",j=1,E={AUDIO_FILES:"audioFiles",TRANSCRIPTIONS:"transcriptions",SYNC_QUEUE:"syncQueue",SETTINGS:"settings"};function C(){return new Promise((i,e)=>{const t=indexedDB.open(_,j);t.onupgradeneeded=a=>{const n=a.target.result;H(n)},t.onsuccess=a=>{i(a.target.result)},t.onerror=a=>{e(a.target.error)}})}function H(i){if(!i.objectStoreNames.contains(E.AUDIO_FILES)){const e=i.createObjectStore(E.AUDIO_FILES,{keyPath:"id"});e.createIndex("recordedAt","recordedAt",{unique:!1}),e.createIndex("syncStatus","syncStatus",{unique:!1})}if(!i.objectStoreNames.contains(E.TRANSCRIPTIONS)){const e=i.createObjectStore(E.TRANSCRIPTIONS,{keyPath:"id"});e.createIndex("ownerId","ownerId",{unique:!1}),e.createIndex("status","status",{unique:!1}),e.createIndex("recordedAt","recordedAt",{unique:!1})}if(!i.objectStoreNames.contains(E.SYNC_QUEUE)){const e=i.createObjectStore(E.SYNC_QUEUE,{keyPath:"id",autoIncrement:!0});e.createIndex("priority","priority",{unique:!1}),e.createIndex("type","type",{unique:!1})}i.objectStoreNames.contains(E.SETTINGS)||i.createObjectStore(E.SETTINGS,{keyPath:"key"})}function U(){if(document.getElementById("app-styles"))return;const i=document.createElement("style");i.id="app-styles",i.textContent=`
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
  `,document.head.appendChild(i)}const T=(i,e=22)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${e}" height="${e}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${i}</svg>`,b={bell:T('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),user:T('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),search:T('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),house:T('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),calendar:T('<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>'),settings:T('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),mic:T('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>'),arrowLeft:T('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',20),chevronRight:T('<path d="m9 18 6-6-6-6"/>',18),pause:T('<rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/>',24),square:T('<rect width="18" height="18" x="3" y="3" rx="2"/>',28),flag:T('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',24),share:T('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>'),download:T('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>')};function V(i){const e=document.createElement("div");e.className="screen active";function t(s){if(s<60)return`${Math.round(s)}s`;const o=Math.floor(s/60);return o<60?`${o} min`:`${Math.floor(o/60)}h ${o%60}min`}function a(s){const o=new Date,c=o.getTime()-s.getTime(),l=864e5;return c<l&&o.getDate()===s.getDate()?`Hoy, ${s.toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"})}`:c<2*l?`Ayer, ${s.toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"})}`:s.toLocaleDateString("es",{weekday:"short",hour:"2-digit",minute:"2-digit"})}function n(){const s=new Date().getHours();return s<12?"Buenos días":s<18?"Buenas tardes":"Buenas noches"}function r(){const s=i.getMeetings(),o=s.length,c=s.reduce((p,v)=>p+v.duration,0)/3600,l=s.filter(p=>p.status==="processing").length,g=s.length>0?s.slice(0,10).map(p=>`
          <button class="meeting-card" type="button" data-meeting-id="${p.id}">
            <div class="meeting-card-left">
              <span class="meeting-card-title">${W(p.title)}</span>
              <div class="meeting-card-meta">
                <span>${a(p.date)}</span><span>${t(p.duration)}</span>
              </div>
              <span class="meeting-card-badge ${p.status==="transcribed"?"badge-green":"badge-yellow"}">
                ${p.status==="transcribed"?"✓ Transcrita":"⟳ Procesando"}
              </span>
            </div>
            <span class="meeting-card-arrow">${b.chevronRight}</span>
          </button>
        `).join(""):`<div style="padding:24px;text-align:center;color:var(--text-tertiary);font-size:14px;">
           No hay reuniones aún. Graba tu primera reunión.
         </div>`;e.innerHTML=`
      <!-- Header -->
      <div class="header">
        <div class="header-title-wrap">
          <span class="header-greeting">${n()}</span>
          <span class="header-app-title">KeepWeChat</span>
        </div>
        <div class="header-icons">
          <button type="button" aria-label="Notificaciones">${b.bell}</button>
          <button type="button" aria-label="Perfil">${b.user}</button>
        </div>
      </div>

      <!-- Search bar -->
      <div class="search-bar">
        <button class="search-inner" type="button" aria-label="Buscar en transcripciones">
          ${b.search}
          <span>Buscar en transcripciones...</span>
        </button>
      </div>

      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-value" style="color:var(--text-primary)">${o}</span>
          <span class="stat-label">Reuniones</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" style="color:var(--accent-indigo)">${c.toFixed(1)}h</span>
          <span class="stat-label">Transcritas</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" style="color:var(--accent-coral)">${l}</span>
          <span class="stat-label">Pendientes</span>
        </div>
      </div>

      <!-- Section header -->
      <div class="section-header">
        <span class="section-title">Reuniones recientes</span>
        <button class="section-link" type="button">Ver todas</button>
      </div>

      <!-- Meeting list -->
      <div class="meeting-list">${g}</div>

      <div class="spacer"></div>

      <!-- FAB -->
      <div class="fab-wrap">
        <button class="fab" type="button" id="record-fab">
          ${b.mic}
          <span>Grabar reunión</span>
        </button>
      </div>
    `,e.querySelector("#record-fab").addEventListener("click",i.onRecordClick),e.querySelector(".search-inner").addEventListener("click",i.onSearchClick),e.querySelectorAll(".meeting-card[data-meeting-id]").forEach(p=>{p.addEventListener("click",()=>{const v=p.dataset.meetingId;i.onMeetingClick(v)})})}return r(),{element:e,refresh:r}}function W(i){const e=document.createElement("div");return e.textContent=i,e.innerHTML}function G(i){const e=document.createElement("div");e.className="screen",e.style.cssText="padding-bottom:0;";const t=15;e.innerHTML=`
    <!-- Header -->
    <div class="rec-header">
      <button class="rec-back" type="button" id="rec-back">
        ${b.arrowLeft}
        <span>Atrás</span>
      </button>
      <div class="rec-live-badge">
        <div class="rec-live-dot"></div>
        <span class="rec-live-text">EN VIVO</span>
      </div>
    </div>

    <!-- Title -->
    <div class="rec-title-area">
      <div class="rec-title-text">Nueva Grabación</div>
      <div class="rec-subtitle">Reunión presencial · Español</div>
    </div>

    <!-- Wave area -->
    <div class="rec-wave-area">
      <div class="rec-timer" id="rec-timer">00:00:00</div>
      <div class="rec-waveform" id="rec-waveform">
        ${Array.from({length:t},()=>'<div class="bar" style="height:20px"></div>').join("")}
      </div>
      <div class="rec-speaker-info">
        <div class="rec-speaker-dot"></div>
        <span class="rec-speaker-text">Escuchando...</span>
      </div>
    </div>

    <!-- Live transcript -->
    <div class="rec-live-transcript">
      <div class="rec-lt-title">Transcripción en vivo</div>
      <div id="rec-transcript-lines"></div>
      <div id="rec-interim" class="rec-lt-line" style="opacity:0.5;display:none;">
        <span class="rec-lt-text" style="font-style:italic;color:var(--text-tertiary)"></span>
      </div>
    </div>

    <!-- Controls -->
    <div class="rec-controls">
      <button class="rec-ctrl-btn secondary" type="button" id="rec-pause" aria-label="Pausar">
        ${b.pause}
      </button>
      <button class="rec-ctrl-btn stop" type="button" id="rec-stop" aria-label="Detener grabación">
        ${b.square}
      </button>
      <button class="rec-ctrl-btn secondary" type="button" id="rec-flag" aria-label="Marcar momento">
        ${b.flag}
      </button>
    </div>
  `;const a=e.querySelector("#rec-timer"),r=e.querySelector("#rec-waveform").querySelectorAll(".bar"),s=e.querySelector("#rec-transcript-lines"),o=e.querySelector(".rec-speaker-text"),c=e.querySelector("#rec-interim"),l=c.querySelector(".rec-lt-text");e.querySelector("#rec-back").addEventListener("click",i.onBack),e.querySelector("#rec-stop").addEventListener("click",i.onStop),e.querySelector("#rec-pause").addEventListener("click",i.onPause),e.querySelector("#rec-flag").addEventListener("click",i.onFlag);function g(x){const M=Math.floor(x/3600),u=Math.floor(x%3600/60),f=x%60;return[M,u,f].map(d=>d.toString().padStart(2,"0")).join(":")}function p(){a.textContent="00:00:00",s.innerHTML="",r.forEach(x=>{x.style.height="20px"})}function v(x){a.textContent=g(x)}function w(){r.forEach(x=>{const M=10+Math.random()*50;x.style.height=`${M}px`})}function I(x,M,u){c.style.display="none";const f=document.createElement("div");for(f.className="rec-lt-line",f.innerHTML=`
      <span class="rec-lt-speaker" style="color:${u}">${x}:</span>
      <span class="rec-lt-text">${M}</span>
    `,s.appendChild(f);s.children.length>5;)s.removeChild(s.firstChild)}function y(x){x?(l.textContent=x,c.style.display="flex"):c.style.display="none"}function k(x){o.textContent=x}return{element:e,reset:p,updateTimer:v,animateWaveform:w,addTranscriptLine:I,updateInterim:y,updateSpeakerInfo:k}}function K(){const i=document.createElement("div");i.className="screen",i.innerHTML=`
    <div class="search-screen-header">
      <div class="search-screen-title">Buscar</div>
    </div>

    <div class="search-input-wrap">
      <div class="search-input-inner">
        ${b.search}
        <input type="search" placeholder="Buscar en transcripciones..." aria-label="Buscar" />
      </div>
    </div>

    <div class="search-filters">
      <button class="filter-chip active" type="button">Todas</button>
      <button class="filter-chip" type="button">${b.calendar} Fecha</button>
      <button class="filter-chip" type="button">${b.user} Hablante</button>
    </div>

    <div class="search-result-count">3 resultados encontrados</div>

    <div class="search-results">
      <div class="search-result-card">
        <span class="search-result-title">Sprint Planning Q1</span>
        <span class="search-result-meta">Hoy, 10:00 AM · María</span>
        <div class="search-result-text">...necesitamos <mark>cerrar el sprint</mark> antes del viernes...</div>
      </div>
      <div class="search-result-card">
        <span class="search-result-title">Revisión de Diseño</span>
        <span class="search-result-meta">Ayer, 3:30 PM · Carlos</span>
        <div class="search-result-text">...el <mark>diseño</mark> del dashboard necesita ajustes...</div>
      </div>
      <div class="search-result-card">
        <span class="search-result-title">Standup Diario</span>
        <span class="search-result-meta">Lun, 9:00 AM · Ana</span>
        <div class="search-result-text">...voy a <mark>terminar</mark> la integración hoy...</div>
      </div>
    </div>
  `;const e=i.querySelectorAll(".filter-chip");return e.forEach(t=>{t.addEventListener("click",()=>{e.forEach(a=>a.classList.remove("active")),t.classList.add("active")})}),{element:i}}const P=["var(--accent-coral)","var(--accent-indigo)","var(--accent-green)","var(--accent-orange)"];function Y(i){const e=document.createElement("div");e.className="screen",e.style.cssText="padding-bottom:0;",e.innerHTML=`
    <div class="trans-header">
      <button class="trans-back" type="button" id="detail-back">
        ${b.arrowLeft} <span>Atrás</span>
      </button>
      <div class="trans-actions">
        <button type="button" id="detail-share" aria-label="Compartir">${b.share}</button>
        <button type="button" id="detail-export" aria-label="Exportar">${b.download}</button>
      </div>
    </div>
    <div class="trans-title-area">
      <div class="trans-title" id="detail-title"></div>
      <div class="trans-meta" id="detail-meta"></div>
    </div>
    <div class="trans-speakers" id="detail-speakers"></div>
    <div class="trans-divider"></div>

    <!-- Tabs -->
    <div style="display:flex;gap:0;padding:0 24px;margin-top:8px;">
      <button class="filter-chip active" type="button" data-tab="transcript">Transcripción</button>
      <button class="filter-chip" type="button" data-tab="summary">Resumen</button>
      <button class="filter-chip" type="button" data-tab="actions">Accionables</button>
    </div>

    <!-- Tab content -->
    <div class="trans-content" id="detail-content"></div>

    <!-- Export modal (hidden) -->
    <div id="export-modal" class="hidden" style="
      position:fixed;top:0;left:0;right:0;bottom:0;
      background:rgba(0,0,0,0.4);z-index:200;
      display:flex;align-items:flex-end;justify-content:center;">
      <div style="
        background:var(--bg-primary);border-radius:24px 24px 0 0;
        padding:24px;width:100%;max-width:430px;">
        <div style="font-family:var(--font-display);font-size:18px;font-weight:700;margin-bottom:16px;">
          Exportar transcripción
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;" id="export-options"></div>
        <button type="button" id="export-cancel" style="
          margin-top:16px;width:100%;padding:14px;border:none;
          border-radius:16px;background:var(--bg-surface);
          font-family:var(--font-body);font-size:15px;font-weight:600;
          cursor:pointer;color:var(--text-secondary);">
          Cancelar
        </button>
      </div>
    </div>
  `;const t=e.querySelector("#detail-title"),a=e.querySelector("#detail-meta"),n=e.querySelector("#detail-speakers"),r=e.querySelector("#detail-content"),s=e.querySelector("#export-modal"),o=e.querySelector("#export-options"),c=e.querySelectorAll("[data-tab]");let l=null,g="transcript";e.querySelector("#detail-back").addEventListener("click",i.onBack),c.forEach(d=>{d.addEventListener("click",()=>{g=d.dataset.tab,c.forEach(h=>h.classList.toggle("active",h===d)),l&&y(l)})}),e.querySelector("#detail-export").addEventListener("click",()=>{s.classList.remove("hidden"),s.style.display="flex"}),e.querySelector("#export-cancel").addEventListener("click",()=>{s.classList.add("hidden")}),s.addEventListener("click",d=>{d.target===s&&s.classList.add("hidden")});function p(d){if(d<60)return`${Math.round(d)}s`;const h=Math.floor(d/60);return h<60?`${h} min`:`${Math.floor(h/60)}h ${h%60}min`}function v(d){const h=Math.floor(d/60),m=Math.floor(d%60);return`${h}:${m.toString().padStart(2,"0")}`}function w(d){return P[d%P.length]}function I(d){const h=["var(--accent-coral-light)","var(--badge-indigo-bg)","var(--badge-green-bg)","var(--badge-yellow-bg)"];return h[d%h.length]}function y(d){g==="transcript"?k(d):g==="summary"?x(d):M(d)}function k(d){const h=new Map;d.transcription.speakers.forEach((m,S)=>h.set(m.id,S)),r.innerHTML=d.transcription.segments.map(m=>{const S=h.get(m.speakerId)??0,L=w(S);return`
        <div class="trans-segment">
          <span class="trans-seg-time">${v(m.startTime)} — ${v(m.endTime)}</span>
          <span class="trans-seg-speaker" style="color:${L}">${$(m.speakerLabel)}</span>
          <span class="trans-seg-text">${$(m.text)}</span>
        </div>`}).join("")}function x(d){const{summary:h,minutes:m}=d;let S=`
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div style="background:var(--bg-surface);border-radius:16px;padding:16px;">
          <div style="font-family:var(--font-display);font-size:15px;font-weight:700;margin-bottom:8px;">
            Temas tratados
          </div>
          <ul style="padding-left:18px;display:flex;flex-direction:column;gap:4px;">
            ${h.topics.map(L=>`<li style="font-size:14px;color:var(--text-primary)">${$(L)}</li>`).join("")}
          </ul>
        </div>`;h.keyPoints.length>0&&(S+=`
        <div style="background:var(--bg-surface);border-radius:16px;padding:16px;">
          <div style="font-family:var(--font-display);font-size:15px;font-weight:700;margin-bottom:8px;">
            Puntos clave
          </div>
          <ul style="padding-left:18px;display:flex;flex-direction:column;gap:4px;">
            ${h.keyPoints.map(L=>`<li style="font-size:14px;color:var(--text-primary)">${$(L)}</li>`).join("")}
          </ul>
        </div>`),m.decisions.length>0&&(S+=`
        <div style="background:var(--bg-surface);border-radius:16px;padding:16px;">
          <div style="font-family:var(--font-display);font-size:15px;font-weight:700;margin-bottom:8px;">
            Decisiones
          </div>
          <ul style="padding-left:18px;display:flex;flex-direction:column;gap:4px;">
            ${m.decisions.map(L=>`<li style="font-size:14px;color:var(--text-primary)">${$(L)}</li>`).join("")}
          </ul>
        </div>`),S+="</div>",r.innerHTML=S}function M(d){if(d.actionItems.length===0){r.innerHTML=`
        <div style="text-align:center;padding:32px;color:var(--text-tertiary);font-size:14px;">
          No se detectaron accionables en esta reunión.
        </div>`;return}r.innerHTML=`
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${d.actionItems.map(h=>`
          <div style="background:var(--bg-surface);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:6px;">
            <div style="font-size:14px;font-weight:500;color:var(--text-primary)">${$(h.description)}</div>
            <div style="font-size:12px;color:var(--text-secondary)">Asignado a: ${$(h.assignedToLabel)}</div>
          </div>
        `).join("")}
      </div>`}function u(d){if(!l)return;const h=i.exportService.export(l.transcription,d),m=d==="md"?"md":d,S=d==="md"?"text/markdown":d==="vtt"?"text/vtt":"text/plain",L=new Blob([h],{type:S}),R=URL.createObjectURL(L),N=document.createElement("a");N.href=R,N.download=`${l.title.replace(/\s+/g,"_")}.${m}`,N.click(),URL.revokeObjectURL(R),s.classList.add("hidden")}function f(d){l=d,g="transcript",c.forEach(m=>m.classList.toggle("active",m.dataset.tab==="transcript")),t.textContent=d.title,a.innerHTML=`
      <span>${d.date.toLocaleDateString("es")}</span>
      <span>·</span>
      <span>${p(d.duration)}</span>
      <span>·</span>
      <span>${d.transcription.segments.length} segmentos</span>
    `,n.innerHTML=d.transcription.speakers.map((m,S)=>`
      <span class="speaker-badge" style="background:${I(S)};color:${w(S)}">
        ${$(m.label)}
      </span>
    `).join("");const h=[{format:"vtt",label:"VTT",desc:"Subtítulos WebVTT"},{format:"txt",label:"TXT",desc:"Texto plano"},{format:"md",label:"Markdown",desc:"Formato Markdown"}];o.innerHTML=h.map(m=>`
      <button type="button" data-format="${m.format}" style="
        display:flex;flex-direction:column;gap:2px;padding:14px 16px;
        background:var(--bg-surface);border-radius:16px;border:none;
        cursor:pointer;text-align:left;font-family:var(--font-body);">
        <span style="font-size:15px;font-weight:600;color:var(--text-primary)">${m.label}</span>
        <span style="font-size:12px;color:var(--text-secondary)">${m.desc}</span>
      </button>
    `).join(""),o.querySelectorAll("button").forEach(m=>{m.addEventListener("click",()=>u(m.dataset.format))}),y(d)}return{element:e,show:f}}function $(i){const e=document.createElement("div");return e.textContent=i,e.innerHTML}async function B(i,e){const t=await C();return new Promise((a,n)=>{const r=t.transaction(i,"readwrite"),o=r.objectStore(i).put(e);o.onsuccess=()=>a(),o.onerror=()=>n(o.error),r.oncomplete=()=>t.close()})}async function Z(i){const e=await C();return new Promise((t,a)=>{const n=e.transaction(i,"readonly"),s=n.objectStore(i).getAll();s.onsuccess=()=>t(s.result),s.onerror=()=>a(s.error),n.oncomplete=()=>e.close()})}class A extends Error{constructor(e,t){super(e),this.code=t,this.name="AudioCaptureError"}}class Q{constructor(){this.recordings=new Map}async startRecording(e){let t;try{t=await navigator.mediaDevices.getUserMedia({audio:!0})}catch(c){const l=c instanceof Error?c.message:String(c);throw l.includes("Permission denied")||l.includes("NotAllowedError")?new A("Microphone permission denied by user","PERMISSION_DENIED"):new A(`Microphone not available: ${l}`,"MICROPHONE_NOT_AVAILABLE")}const a=crypto.randomUUID(),n={id:a,startedAt:new Date,source:e.source,status:"recording"},r=new MediaRecorder(t),s=[],o={session:n,config:e,mediaStream:t,mediaRecorder:r,chunks:s,startTimestamp:Date.now()};r.ondataavailable=c=>{c.data.size>0&&s.push(c.data)};for(const c of t.getTracks())c.onended=()=>{o.session.status==="recording"&&(o.session.status="stopped",r.stop())};return r.onerror=()=>{o.session.status="stopped",this.stopTracks(t)},r.start(),this.recordings.set(a,o),{...n}}async stopRecording(e){const t=this.recordings.get(e);if(!t)throw new A(`No recording found for session ${e}`,"SESSION_NOT_FOUND");if(t.session.status==="stopped")throw new A(`Recording ${e} is already stopped`,"ALREADY_STOPPED");const a=await this.finalizeRecorder(t);t.session.status="stopped",this.stopTracks(t.mediaStream);const n=(Date.now()-t.startTimestamp)/1e3,r={id:e,blob:a,duration:n,recordedAt:t.session.startedAt,source:t.config.source,language:t.config.language,syncStatus:"pending"};return await B(E.AUDIO_FILES,r),this.recordings.delete(e),r}getStatus(e){const t=this.recordings.get(e);if(!t)throw new A(`No recording found for session ${e}`,"SESSION_NOT_FOUND");const a=(Date.now()-t.startTimestamp)/1e3;return{isRecording:t.session.status==="recording",duration:a,source:t.config.source}}finalizeRecorder(e){return new Promise(t=>{const{mediaRecorder:a,chunks:n}=e;if(a.state==="inactive"){t(new Blob(n,{type:"audio/webm"}));return}a.onstop=()=>{t(new Blob(n,{type:"audio/webm"}))},a.stop()})}stopTracks(e){for(const t of e.getTracks())t.stop()}}class z extends Error{constructor(e,t){super(e),this.code=t,this.name="STTError"}}class X{constructor(){this.loaded=!1}async load(){this.loaded=!0}isLoaded(){return this.loaded}async transcribe(e,t,a){const n=a??(e.size>0?Math.max(1,e.size/16e3):0);if(n<=0)return[];const r=5,s=Math.max(1,Math.ceil(n/r)),o=[],l={es:["Bienvenidos a la reunión de hoy.","Vamos a revisar los puntos pendientes.","El siguiente tema es importante.","Necesitamos tomar una decisión al respecto.","Perfecto, pasemos al siguiente punto."],en:["Welcome to today's meeting.","Let's review the pending items.","The next topic is important.","We need to make a decision on this.","Great, let's move on to the next point."]}[t];for(let g=0;g<s;g++){const p=g*r,v=Math.min((g+1)*r,n);o.push({startTime:p,endTime:v,text:l[g%l.length],confidence:.75+Math.random()*.2})}return o}}class J{constructor(e){this.backend=e??new X}async loadModel(){await this.backend.load()}isReady(){return this.backend.isLoaded()}async transcribe(e,t){if(!this.isReady())throw new z("STT model is not loaded. Call loadModel() first.","MODEL_NOT_LOADED");const a=t??e.language;if(!a)throw new z("Could not determine audio language. Provide a language explicitly.","LANGUAGE_NOT_DETECTED");const n=await this.backend.transcribe(e.blob,a);if(n.length===0)throw new z("Transcription produced no segments — audio may contain no detectable speech.","EMPTY_TRANSCRIPTION");return{segments:n,language:a,duration:e.duration}}}class ee extends Error{constructor(e,t){super(e),this.code=t,this.name="DiarizationError"}}const te=.5,F="speaker_unknown",ne="Hablante no identificado";class re{constructor(e=3){this.speakerCount=e}async assignSpeakers(e,t){return t.map((a,n)=>({speakerId:`speaker_${n%this.speakerCount+1}`,confidence:a.confidence}))}}const ae=[/\b(?:hola|buenos días|buenas tardes|buenas noches)?\s*,?\s*soy\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i,/\bmi nombre es\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i,/\bme llamo\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i,/\b(?:hi|hello|hey)?\s*,?\s*I'?m\s+([A-Z][a-z]+)/i,/\bmy name is\s+([A-Z][a-z]+)/i];function se(i){for(const e of ae){const t=i.match(e);if(t!=null&&t[1])return t[1]}}class ie{constructor(e){this.backend=e??new re}async diarize(e,t){if(t.length===0)throw new ee("Cannot diarize: no transcription segments provided.","NO_SEGMENTS");const a=await this.backend.assignSpeakers(e,t),n=new Map;let r=1;const s=t.map((l,g)=>{const p=a[g],v=p.confidence<te,w=v?F:p.speakerId,I=p.confidence;!v&&!n.has(w)&&n.set(w,r++);const y=n.get(w),k=v?ne:`Hablante ${y}`;return{...l,speakerId:w,speakerLabel:k,speakerConfidence:I}}),o=new Map;for(const l of s){if(l.speakerId===F)continue;const g=se(l.text);g&&!o.has(l.speakerId)&&o.set(l.speakerId,g);const p=o.get(l.speakerId);p&&(l.speakerLabel=p)}const c=[];for(const[l,g]of n){const p=o.get(l);c.push({id:l,label:p??`Hablante ${g}`,identifiedName:p})}return{segments:s,speakers:c,language:e.language}}}const oe="unassigned",ce="Sin asignar",de={es:{presupuesto:"Presupuesto",costo:"Costos",costos:"Costos",gasto:"Costos",proyecto:"Proyecto",plazo:"Plazos",plazos:"Plazos",fecha:"Plazos",deadline:"Plazos",diseño:"Diseño",cliente:"Cliente",clientes:"Cliente",equipo:"Equipo",estrategia:"Estrategia",marketing:"Marketing",ventas:"Ventas",producto:"Producto",desarrollo:"Desarrollo",tecnología:"Tecnología",problema:"Problemas",riesgo:"Riesgos",contrato:"Contratos"},en:{budget:"Budget",cost:"Costs",costs:"Costs",expense:"Costs",project:"Project",deadline:"Deadlines",timeline:"Deadlines",schedule:"Deadlines",design:"Design",client:"Client",clients:"Client",team:"Team",strategy:"Strategy",marketing:"Marketing",sales:"Sales",product:"Product",development:"Development",technology:"Technology",issue:"Issues",risk:"Risks",contract:"Contracts"}},le={es:[/\b(?:hay que|necesitamos|debemos|tenemos que|se debe|se necesita)\s+(.+)/i,/\b(?:me comprometo a|voy a|me encargo de)\s+(.+)/i,/\b(?:por favor|favor)\s+(.+)/i,/\b(?:tarea|acción|pendiente|accionable):\s*(.+)/i,/\b(?:queda pendiente)\s+(.+)/i],en:[/\b(?:we need to|we should|we must|we have to|need to)\s+(.+)/i,/\b(?:I will|I'll|I'm going to|I am going to)\s+(.+)/i,/\b(?:please)\s+(.+)/i,/\b(?:action item|task|todo|to-do):\s*(.+)/i,/\b(?:let's)\s+(.+)/i]},pe={es:[/\b(?:se decidió|decidimos|se acordó|acordamos|se aprobó|aprobamos)\s+(.+)/i,/\b(?:la decisión es|la decisión fue)\s+(.+)/i,/\b(?:queda aprobado|queda decidido)\s+(.+)/i,/\b(?:se resolvió|resolvimos)\s+(.+)/i],en:[/\b(?:we decided|it was decided|we agreed|it was agreed)\s+(.+)/i,/\b(?:the decision is|the decision was)\s+(.+)/i,/\b(?:we resolved|it was resolved|we approved)\s+(.+)/i,/\b(?:let's go with|we'll go with)\s+(.+)/i]};class ue{extractTopics(e,t){const a=de[t],n=new Set;for(const r of e){const s=r.text.toLowerCase().split(/\s+/);for(const o of s){const c=o.replace(/[.,;:!?()]/g,"");a[c]&&n.add(a[c])}}return Array.from(n)}extractKeyPoints(e,t){const a=[],n=t==="es"?["importante","clave","decisión","acordamos","conclusión","resumen"]:["important","key","decision","agreed","conclusion","summary"];for(const r of e){const s=r.text.toLowerCase();n.some(o=>s.includes(o))&&a.push(r.text.trim())}return a}detectActionItems(e,t){const a=le[t],n=[];for(let r=0;r<e.length;r++){const s=e[r].text;for(const o of a){const c=s.match(o);if(c!=null&&c[1]){n.push({description:c[1].trim(),segmentIndex:r});break}}}return n}detectDecisions(e,t){const a=pe[t],n=[];for(const r of e)for(const s of a){const o=r.text.match(s);if(o!=null&&o[1]){n.push(o[1].trim());break}}return n}}let ge=1;function fe(){return`action_${ge++}`}class me{constructor(e){this.backend=e??new ue}async generateSummary(e){const{segments:t,language:a}=e,n=this.backend.extractTopics(t,a),r=this.backend.extractKeyPoints(t,a);return n.length===0&&n.push(a==="es"?"Discusión general":"General discussion"),{topics:n,keyPoints:r,language:a}}async generateMinutes(e,t,a){const{segments:n,speakers:r,language:s}=e,o=this.backend.detectDecisions(n,s);return{title:t.topics.length>0?s==="es"?`Acta: ${t.topics[0]}`:`Minutes: ${t.topics[0]}`:s==="es"?"Acta de reunión":"Meeting Minutes",date:new Date,attendees:r,topicsDiscussed:t.topics,decisions:o,actionItems:a,language:s}}async extractActionItems(e){const{segments:t,speakers:a,language:n}=e,r=this.backend.detectActionItems(t,n),s=new Map;for(const o of a)s.set(o.id,o);return r.map(o=>{const c=t[o.segmentIndex],l=c?s.get(c.speakerId):void 0,g=l!==void 0;return{id:fe(),description:o.description,assignedTo:g?l.id:oe,assignedToLabel:g?l.identifiedName??l.label:ce,sourceSegmentId:c==null?void 0:c.speakerId}})}}class he{export(e,t){if(!e||!e.segments)throw new Error("Export failed: transcription data is corrupted or missing segments.");switch(t){case"vtt":return this.exportVTT(e);case"txt":return this.exportTXT(e);case"md":return this.exportMarkdown(e);default:throw new Error(`Unsupported export format: ${t}`)}}importVTT(e){if(!e||typeof e!="string")throw new Error("Import failed: VTT content is empty or invalid.");const t=e.split(`
`);if(!t[0]||!t[0].trim().startsWith("WEBVTT"))throw new Error("Import failed: missing WEBVTT header at line 1.");const a=[],n=new Map;let r=1;for(;r<t.length&&t[r].trim()!=="";)r++;for(;r<t.length;){if(t[r].trim()===""){r++;continue}const c=t[r].trim();if(r++,r>=t.length)throw new Error(`Import failed: unexpected end of file after cue identifier at line ${r}.`);const l=t[r].trim(),g=l.match(/^(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})$/);if(!g)throw new Error(`Import failed: malformed timestamp at line ${r+1}: "${l}".`);r++;const p=this.parseVTTTimestamp(g[1]),v=this.parseVTTTimestamp(g[2]),w=[];for(;r<t.length&&t[r].trim()!=="";)w.push(t[r].trim()),r++;if(w.length===0)throw new Error(`Import failed: missing cue text after timestamp at line ${r}.`);const I=w.join(" "),y=c.match(/^(speaker_\d+)\s*-\s*(.+)$/);let k,x;y?(k=y[1],x=y[2]):(k=c,x=c),n.has(k)||n.set(k,{id:k,label:x}),a.push({startTime:p,endTime:v,text:I,confidence:1,speakerId:k,speakerLabel:x,speakerConfidence:1})}const s=t[0].match(/Language:\s*(es|en)/i),o=s?s[1]:"es";return{segments:a,speakers:Array.from(n.values()),language:o}}exportVTT(e){const t=`WEBVTT - Language: ${e.language}`,a=e.segments.map(n=>{const r=this.formatVTTTimestamp(n.startTime),s=this.formatVTTTimestamp(n.endTime);return`${`${n.speakerId} - ${n.speakerLabel}`}
${r} --> ${s}
${n.text}`});return[t,"",...a].join(`

`)}exportTXT(e){return e.segments.map(t=>{const a=this.formatTimestamp(t.startTime),n=this.formatTimestamp(t.endTime);return`[${a} - ${n}] ${t.speakerLabel}: ${t.text}`}).join(`
`)}exportMarkdown(e){const t=["# Transcription",""];for(const a of e.segments){const n=this.formatTimestamp(a.startTime),r=this.formatTimestamp(a.endTime);t.push(`**${a.speakerLabel}** _(${n} - ${r})_`),t.push(""),t.push(a.text),t.push("")}return t.join(`
`)}formatVTTTimestamp(e){const t=Math.floor(e/3600),a=Math.floor(e%3600/60),n=Math.floor(e%60),r=Math.round((e-Math.floor(e))*1e3);return String(t).padStart(2,"0")+":"+String(a).padStart(2,"0")+":"+String(n).padStart(2,"0")+"."+String(r).padStart(3,"0")}parseVTTTimestamp(e){const t=e.split(":"),a=parseInt(t[0],10),n=parseInt(t[1],10),r=t[2].split("."),s=parseInt(r[0],10),o=parseInt(r[1],10);return a*3600+n*60+s+o/1e3}formatTimestamp(e){const t=Math.floor(e/3600),a=Math.floor(e%3600/60),n=Math.floor(e%60);return String(t).padStart(2,"0")+":"+String(a).padStart(2,"0")+":"+String(n).padStart(2,"0")}}class D{constructor(e,t){this.recognition=null,this.isRunning=!1,this.startTimestamp=0,this.segments=[],this.segmentStartTime=0,this.language=e==="es"?"es-ES":"en-US",this.callbacks=t}static isSupported(){return!!(window.SpeechRecognition||window.webkitSpeechRecognition)}start(){if(this.isRunning)return;const e=window.SpeechRecognition||window.webkitSpeechRecognition;if(!e){this.callbacks.onError("Web Speech API no disponible en este navegador");return}this.recognition=new e,this.recognition.continuous=!0,this.recognition.interimResults=!0,this.recognition.lang=this.language,this.recognition.maxAlternatives=1,this.startTimestamp=Date.now(),this.segmentStartTime=0,this.segments=[],this.isRunning=!0,this.recognition.onresult=t=>{const a=(Date.now()-this.startTimestamp)/1e3;for(let n=t.resultIndex;n<t.results.length;n++){const r=t.results[n],s=r[0].transcript.trim();if(s)if(r.isFinal){const o={startTime:this.segmentStartTime,endTime:a,text:s,confidence:r[0].confidence||.85};this.segments.push(o),this.segmentStartTime=a,this.callbacks.onSegment({text:s,startTime:o.startTime,endTime:o.endTime,isFinal:!0})}else this.callbacks.onInterim(s)}},this.recognition.onerror=t=>{t.error==="no-speech"||t.error==="aborted"||this.callbacks.onError(`Speech recognition error: ${t.error}`)},this.recognition.onend=()=>{if(this.isRunning)try{this.recognition.start()}catch{}};try{this.recognition.start()}catch(t){this.callbacks.onError(`No se pudo iniciar el reconocimiento de voz: ${t}`)}}stop(){if(this.isRunning=!1,this.recognition){try{this.recognition.stop()}catch{}this.recognition=null}return[...this.segments]}getSegments(){return[...this.segments]}}class xe{constructor(){this.audioCapture=new Q,this.exportService=new he,this.meetings=[],this.currentSessionId=null,this.liveTranscriber=null,this.currentLanguage="es",this.sttEngine=new J,this.diarization=new ie,this.nlpService=new me}async init(){await this.sttEngine.loadModel(),await this.loadMeetingsFromDB()}async startRecording(e="es",t){this.currentLanguage=e;const a=await this.audioCapture.startRecording({source:"microphone",language:e});return this.currentSessionId=a.id,D.isSupported()&&(this.liveTranscriber=new D(e,{onInterim:n=>t==null?void 0:t.onInterim(n),onSegment:n=>t==null?void 0:t.onSegment(n),onError:n=>console.warn("LiveTranscriber:",n)}),this.liveTranscriber.start()),a.id}get activeSessionId(){return this.currentSessionId}async stopAndProcess(e){if(!this.currentSessionId)throw new Error("No active recording session");const t=this.currentSessionId;this.currentSessionId=null;let a=[];this.liveTranscriber&&(a=this.liveTranscriber.stop(),this.liveTranscriber=null);const n=await this.audioCapture.stopRecording(t);let r;a.length>0?r=a:r=(await this.sttEngine.transcribe(n)).segments;const s=await this.diarization.diarize(n,r),o=await this.nlpService.generateSummary(s),c=await this.nlpService.extractActionItems(s),l=await this.nlpService.generateMinutes(s,o,c),g={id:n.id,status:"local",transcription:s,audioId:n.id,createdAt:Date.now(),updatedAt:Date.now()};await B(E.TRANSCRIPTIONS,g);const p=e??`Reunión ${new Date().toLocaleString("es")}`,v={id:n.id,title:p,date:n.recordedAt,duration:n.duration,status:"transcribed",transcription:s,summary:o,actionItems:c,minutes:l};return this.meetings.unshift(v),{transcriptionId:n.id,audioFile:n,transcription:s,summary:o,actionItems:c,minutes:l}}getMeetings(){return this.meetings}getMeeting(e){return this.meetings.find(t=>t.id===e)}async loadMeetingsFromDB(){try{const e=await Z(E.TRANSCRIPTIONS);for(const t of e){const a=await this.nlpService.generateSummary(t.transcription),n=await this.nlpService.extractActionItems(t.transcription),r=await this.nlpService.generateMinutes(t.transcription,a,n);this.meetings.push({id:t.id,title:`Reunión ${new Date(t.createdAt).toLocaleString("es")}`,date:new Date(t.createdAt),duration:t.transcription.segments.length>0?t.transcription.segments[t.transcription.segments.length-1].endTime:0,status:"transcribed",transcription:t.transcription,summary:a,actionItems:n,minutes:r})}this.meetings.sort((t,a)=>a.date.getTime()-t.date.getTime())}catch{}}}const ve=[{id:"home",icon:b.house,label:"Inicio"},{id:"search",icon:b.search,label:"Buscar"},{id:"calendar",icon:b.calendar,label:"Calendario"},{id:"settings",icon:b.settings,label:"Ajustes"}],O=["var(--accent-coral)","var(--accent-indigo)","var(--accent-green)","var(--accent-orange)"];function ye(){U();const i=new xe;i.init().catch(console.error);let e=null,t=0;const a=document.createElement("div");a.id="app-shell",a.style.cssText="display:flex;flex-direction:column;min-height:100vh;";const n=V({onRecordClick:()=>k(),onSearchClick:()=>y("search"),onMeetingClick:u=>M(u),getMeetings:()=>i.getMeetings()}),r=G({onBack:()=>x(),onStop:()=>x(),onPause:()=>{},onFlag:()=>{}}),s=K(),o=Y({onBack:()=>{n.refresh(),y("home")},exportService:i.exportService}),c=document.createElement("div");c.className="screen",c.style.cssText="padding-bottom:0;",c.innerHTML=`
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:32px;">
      <div style="width:64px;height:64px;border-radius:50%;background:var(--accent-coral-light);
        display:flex;align-items:center;justify-content:center;">
        <div style="width:32px;height:32px;border:3px solid var(--accent-coral);
          border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
      </div>
      <div style="font-family:var(--font-display);font-size:20px;font-weight:700;text-align:center;">
        Procesando grabación...
      </div>
      <div style="font-size:14px;color:var(--text-secondary);text-align:center;">
        Identificando hablantes y generando resumen.
      </div>
    </div>
    <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
  `;const l=document.createElement("div");l.className="screen",l.innerHTML=`
    <div class="settings-screen">
      <div class="settings-title">Calendario</div>
      <p style="color:var(--text-secondary);font-size:14px;">Próximamente: integración con Google Calendar y Microsoft Teams.</p>
    </div>`;const g=document.createElement("div");g.className="screen",g.innerHTML=`
    <div class="settings-screen">
      <div class="settings-title">Ajustes</div>
      <p style="color:var(--text-secondary);font-size:14px;">Configuración de cuenta, idioma y preferencias.</p>
    </div>`;const p=new Map([["home",n.element],["search",s.element],["calendar",l],["settings",g],["recording",r.element],["processing",c],["detail",o.element]]);p.forEach(u=>a.appendChild(u));const v=document.createElement("nav");v.className="nav-bar",v.setAttribute("role","navigation"),v.setAttribute("aria-label","Navegación principal");const w=new Map;ve.forEach(u=>{const f=document.createElement("button");f.className="nav-item",f.type="button",f.innerHTML=`${u.icon}<span>${u.label}</span>`,f.setAttribute("aria-label",u.label),f.addEventListener("click",()=>y(u.id)),w.set(u.id,f),v.appendChild(f)}),a.appendChild(v);const I=["recording","processing","detail"];function y(u){p.forEach((f,d)=>{f.classList.toggle("active",d===u)}),v.style.display=I.includes(u)?"none":"flex",w.forEach((f,d)=>{f.classList.toggle("active",d===u)})}async function k(){try{t=0;const u=D.isSupported();u||r.updateSpeakerInfo("Sin reconocimiento de voz (navegador no compatible)"),await i.startRecording("es",{onInterim:d=>{r.updateInterim(d)},onSegment:d=>{t++;const h=(t-1)%O.length,m=`Hablante ${h+1}`,S=O[h];r.addTranscriptLine(m,d.text,S),r.updateSpeakerInfo(`${m} detectado`)}}),y("recording"),r.reset(),u&&r.updateSpeakerInfo("Escuchando...");let f=0;e=setInterval(()=>{f++,r.updateTimer(f),r.animateWaveform()},1e3)}catch(u){const f=u instanceof Error?u.message:String(u);alert(`No se pudo iniciar la grabación: ${f}`)}}async function x(){if(e&&(clearInterval(e),e=null),!i.activeSessionId){y("home");return}y("processing");try{const u=await i.stopAndProcess(),f=i.getMeeting(u.transcriptionId);f?(o.show(f),y("detail")):(n.refresh(),y("home"))}catch(u){console.error("Processing failed:",u),alert(`Error al procesar: ${u instanceof Error?u.message:String(u)}`),n.refresh(),y("home")}}function M(u){const f=i.getMeeting(u);f&&(o.show(f),y("detail"))}return y("home"),{root:a,navigateTo:y}}async function be(){await C(),await q();const i=document.getElementById("app");if(!i)return;const e=ye();i.appendChild(e.root)}be().catch(console.error);
//# sourceMappingURL=main-TkmqiXPA.js.map
