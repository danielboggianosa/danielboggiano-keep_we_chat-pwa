(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))n(r);new MutationObserver(r=>{for(const a of r)if(a.type==="childList")for(const s of a.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&n(s)}).observe(document,{childList:!0,subtree:!0});function t(r){const a={};return r.integrity&&(a.integrity=r.integrity),r.referrerPolicy&&(a.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?a.credentials="include":r.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function n(r){if(r.ep)return;r.ep=!0;const a=t(r);fetch(r.href,a)}})();async function O(){if(!("serviceWorker"in navigator)){console.warn("Service Workers not supported in this browser.");return}try{const i=await navigator.serviceWorker.register("/sw.js",{scope:"/"});return console.log("Service Worker registered with scope:",i.scope),i}catch(i){console.error("Service Worker registration failed:",i);return}}const B="meeting-transcription-db",_=1,E={AUDIO_FILES:"audioFiles",TRANSCRIPTIONS:"transcriptions",SYNC_QUEUE:"syncQueue",SETTINGS:"settings"};function C(){return new Promise((i,e)=>{const t=indexedDB.open(B,_);t.onupgradeneeded=n=>{const r=n.target.result;j(r)},t.onsuccess=n=>{i(n.target.result)},t.onerror=n=>{e(n.target.error)}})}function j(i){if(!i.objectStoreNames.contains(E.AUDIO_FILES)){const e=i.createObjectStore(E.AUDIO_FILES,{keyPath:"id"});e.createIndex("recordedAt","recordedAt",{unique:!1}),e.createIndex("syncStatus","syncStatus",{unique:!1})}if(!i.objectStoreNames.contains(E.TRANSCRIPTIONS)){const e=i.createObjectStore(E.TRANSCRIPTIONS,{keyPath:"id"});e.createIndex("ownerId","ownerId",{unique:!1}),e.createIndex("status","status",{unique:!1}),e.createIndex("recordedAt","recordedAt",{unique:!1})}if(!i.objectStoreNames.contains(E.SYNC_QUEUE)){const e=i.createObjectStore(E.SYNC_QUEUE,{keyPath:"id",autoIncrement:!0});e.createIndex("priority","priority",{unique:!1}),e.createIndex("type","type",{unique:!1})}i.objectStoreNames.contains(E.SETTINGS)||i.createObjectStore(E.SETTINGS,{keyPath:"key"})}function q(){if(document.getElementById("app-styles"))return;const i=document.createElement("style");i.id="app-styles",i.textContent=`
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
  `,document.head.appendChild(i)}const S=(i,e=22)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${e}" height="${e}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${i}</svg>`,y={bell:S('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),user:S('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),search:S('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),house:S('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),calendar:S('<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>'),settings:S('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),mic:S('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>'),arrowLeft:S('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',20),chevronRight:S('<path d="m9 18 6-6-6-6"/>',18),pause:S('<rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/>',24),square:S('<rect width="18" height="18" x="3" y="3" rx="2"/>',28),flag:S('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',24),share:S('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>'),download:S('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>')};function H(i){const e=document.createElement("div");e.className="screen active";function t(s){if(s<60)return`${Math.round(s)}s`;const o=Math.floor(s/60);return o<60?`${o} min`:`${Math.floor(o/60)}h ${o%60}min`}function n(s){const o=new Date,c=o.getTime()-s.getTime(),d=864e5;return c<d&&o.getDate()===s.getDate()?`Hoy, ${s.toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"})}`:c<2*d?`Ayer, ${s.toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"})}`:s.toLocaleDateString("es",{weekday:"short",hour:"2-digit",minute:"2-digit"})}function r(){const s=new Date().getHours();return s<12?"Buenos días":s<18?"Buenas tardes":"Buenas noches"}function a(){const s=i.getMeetings(),o=s.length,c=s.reduce((p,f)=>p+f.duration,0)/3600,d=s.filter(p=>p.status==="processing").length,u=s.length>0?s.slice(0,10).map(p=>`
          <button class="meeting-card" type="button" data-meeting-id="${p.id}">
            <div class="meeting-card-left">
              <span class="meeting-card-title">${V(p.title)}</span>
              <div class="meeting-card-meta">
                <span>${n(p.date)}</span><span>${t(p.duration)}</span>
              </div>
              <span class="meeting-card-badge ${p.status==="transcribed"?"badge-green":"badge-yellow"}">
                ${p.status==="transcribed"?"✓ Transcrita":"⟳ Procesando"}
              </span>
            </div>
            <span class="meeting-card-arrow">${y.chevronRight}</span>
          </button>
        `).join(""):`<div style="padding:24px;text-align:center;color:var(--text-tertiary);font-size:14px;">
           No hay reuniones aún. Graba tu primera reunión.
         </div>`;e.innerHTML=`
      <!-- Header -->
      <div class="header">
        <div class="header-title-wrap">
          <span class="header-greeting">${r()}</span>
          <span class="header-app-title">KeepWeChat</span>
        </div>
        <div class="header-icons">
          <button type="button" aria-label="Notificaciones">${y.bell}</button>
          <button type="button" aria-label="Perfil">${y.user}</button>
        </div>
      </div>

      <!-- Search bar -->
      <div class="search-bar">
        <button class="search-inner" type="button" aria-label="Buscar en transcripciones">
          ${y.search}
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
          <span class="stat-value" style="color:var(--accent-coral)">${d}</span>
          <span class="stat-label">Pendientes</span>
        </div>
      </div>

      <!-- Section header -->
      <div class="section-header">
        <span class="section-title">Reuniones recientes</span>
        <button class="section-link" type="button">Ver todas</button>
      </div>

      <!-- Meeting list -->
      <div class="meeting-list">${u}</div>

      <div class="spacer"></div>

      <!-- FAB -->
      <div class="fab-wrap">
        <button class="fab" type="button" id="record-fab">
          ${y.mic}
          <span>Grabar reunión</span>
        </button>
      </div>
    `,e.querySelector("#record-fab").addEventListener("click",i.onRecordClick),e.querySelector(".search-inner").addEventListener("click",i.onSearchClick),e.querySelectorAll(".meeting-card[data-meeting-id]").forEach(p=>{p.addEventListener("click",()=>{const f=p.dataset.meetingId;i.onMeetingClick(f)})})}return a(),{element:e,refresh:a}}function V(i){const e=document.createElement("div");return e.textContent=i,e.innerHTML}function U(i){const e=document.createElement("div");e.className="screen",e.style.cssText="padding-bottom:0;";const t=15;e.innerHTML=`
    <!-- Header -->
    <div class="rec-header">
      <button class="rec-back" type="button" id="rec-back">
        ${y.arrowLeft}
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
    </div>

    <!-- Controls -->
    <div class="rec-controls">
      <button class="rec-ctrl-btn secondary" type="button" id="rec-pause" aria-label="Pausar">
        ${y.pause}
      </button>
      <button class="rec-ctrl-btn stop" type="button" id="rec-stop" aria-label="Detener grabación">
        ${y.square}
      </button>
      <button class="rec-ctrl-btn secondary" type="button" id="rec-flag" aria-label="Marcar momento">
        ${y.flag}
      </button>
    </div>
  `;const n=e.querySelector("#rec-timer"),a=e.querySelector("#rec-waveform").querySelectorAll(".bar"),s=e.querySelector("#rec-transcript-lines");e.querySelector("#rec-back").addEventListener("click",i.onBack),e.querySelector("#rec-stop").addEventListener("click",i.onStop),e.querySelector("#rec-pause").addEventListener("click",i.onPause),e.querySelector("#rec-flag").addEventListener("click",i.onFlag);function o(f){const b=Math.floor(f/3600),x=Math.floor(f%3600/60),w=f%60;return[b,x,w].map(k=>k.toString().padStart(2,"0")).join(":")}function c(){n.textContent="00:00:00",s.innerHTML="",a.forEach(f=>{f.style.height="20px"})}function d(f){n.textContent=o(f)}function u(){a.forEach(f=>{const b=10+Math.random()*50;f.style.height=`${b}px`})}function p(f,b,x){const w=document.createElement("div");for(w.className="rec-lt-line",w.innerHTML=`
      <span class="rec-lt-speaker" style="color:${x}">${f}:</span>
      <span class="rec-lt-text">${b}</span>
    `,s.appendChild(w);s.children.length>5;)s.removeChild(s.firstChild)}return{element:e,reset:c,updateTimer:d,animateWaveform:u,addTranscriptLine:p}}function W(){const i=document.createElement("div");i.className="screen",i.innerHTML=`
    <div class="search-screen-header">
      <div class="search-screen-title">Buscar</div>
    </div>

    <div class="search-input-wrap">
      <div class="search-input-inner">
        ${y.search}
        <input type="search" placeholder="Buscar en transcripciones..." aria-label="Buscar" />
      </div>
    </div>

    <div class="search-filters">
      <button class="filter-chip active" type="button">Todas</button>
      <button class="filter-chip" type="button">${y.calendar} Fecha</button>
      <button class="filter-chip" type="button">${y.user} Hablante</button>
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
  `;const e=i.querySelectorAll(".filter-chip");return e.forEach(t=>{t.addEventListener("click",()=>{e.forEach(n=>n.classList.remove("active")),t.classList.add("active")})}),{element:i}}const P=["var(--accent-coral)","var(--accent-indigo)","var(--accent-green)","var(--accent-orange)"];function G(i){const e=document.createElement("div");e.className="screen",e.style.cssText="padding-bottom:0;",e.innerHTML=`
    <div class="trans-header">
      <button class="trans-back" type="button" id="detail-back">
        ${y.arrowLeft} <span>Atrás</span>
      </button>
      <div class="trans-actions">
        <button type="button" id="detail-share" aria-label="Compartir">${y.share}</button>
        <button type="button" id="detail-export" aria-label="Exportar">${y.download}</button>
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
  `;const t=e.querySelector("#detail-title"),n=e.querySelector("#detail-meta"),r=e.querySelector("#detail-speakers"),a=e.querySelector("#detail-content"),s=e.querySelector("#export-modal"),o=e.querySelector("#export-options"),c=e.querySelectorAll("[data-tab]");let d=null,u="transcript";e.querySelector("#detail-back").addEventListener("click",i.onBack),c.forEach(l=>{l.addEventListener("click",()=>{u=l.dataset.tab,c.forEach(h=>h.classList.toggle("active",h===l)),d&&w(d)})}),e.querySelector("#detail-export").addEventListener("click",()=>{s.classList.remove("hidden"),s.style.display="flex"}),e.querySelector("#export-cancel").addEventListener("click",()=>{s.classList.add("hidden")}),s.addEventListener("click",l=>{l.target===s&&s.classList.add("hidden")});function p(l){if(l<60)return`${Math.round(l)}s`;const h=Math.floor(l/60);return h<60?`${h} min`:`${Math.floor(h/60)}h ${h%60}min`}function f(l){const h=Math.floor(l/60),m=Math.floor(l%60);return`${h}:${m.toString().padStart(2,"0")}`}function b(l){return P[l%P.length]}function x(l){const h=["var(--accent-coral-light)","var(--badge-indigo-bg)","var(--badge-green-bg)","var(--badge-yellow-bg)"];return h[l%h.length]}function w(l){u==="transcript"?k(l):u==="summary"?I(l):g(l)}function k(l){const h=new Map;l.transcription.speakers.forEach((m,T)=>h.set(m.id,T)),a.innerHTML=l.transcription.segments.map(m=>{const T=h.get(m.speakerId)??0,M=b(T);return`
        <div class="trans-segment">
          <span class="trans-seg-time">${f(m.startTime)} — ${f(m.endTime)}</span>
          <span class="trans-seg-speaker" style="color:${M}">${$(m.speakerLabel)}</span>
          <span class="trans-seg-text">${$(m.text)}</span>
        </div>`}).join("")}function I(l){const{summary:h,minutes:m}=l;let T=`
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div style="background:var(--bg-surface);border-radius:16px;padding:16px;">
          <div style="font-family:var(--font-display);font-size:15px;font-weight:700;margin-bottom:8px;">
            Temas tratados
          </div>
          <ul style="padding-left:18px;display:flex;flex-direction:column;gap:4px;">
            ${h.topics.map(M=>`<li style="font-size:14px;color:var(--text-primary)">${$(M)}</li>`).join("")}
          </ul>
        </div>`;h.keyPoints.length>0&&(T+=`
        <div style="background:var(--bg-surface);border-radius:16px;padding:16px;">
          <div style="font-family:var(--font-display);font-size:15px;font-weight:700;margin-bottom:8px;">
            Puntos clave
          </div>
          <ul style="padding-left:18px;display:flex;flex-direction:column;gap:4px;">
            ${h.keyPoints.map(M=>`<li style="font-size:14px;color:var(--text-primary)">${$(M)}</li>`).join("")}
          </ul>
        </div>`),m.decisions.length>0&&(T+=`
        <div style="background:var(--bg-surface);border-radius:16px;padding:16px;">
          <div style="font-family:var(--font-display);font-size:15px;font-weight:700;margin-bottom:8px;">
            Decisiones
          </div>
          <ul style="padding-left:18px;display:flex;flex-direction:column;gap:4px;">
            ${m.decisions.map(M=>`<li style="font-size:14px;color:var(--text-primary)">${$(M)}</li>`).join("")}
          </ul>
        </div>`),T+="</div>",a.innerHTML=T}function g(l){if(l.actionItems.length===0){a.innerHTML=`
        <div style="text-align:center;padding:32px;color:var(--text-tertiary);font-size:14px;">
          No se detectaron accionables en esta reunión.
        </div>`;return}a.innerHTML=`
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${l.actionItems.map(h=>`
          <div style="background:var(--bg-surface);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:6px;">
            <div style="font-size:14px;font-weight:500;color:var(--text-primary)">${$(h.description)}</div>
            <div style="font-size:12px;color:var(--text-secondary)">Asignado a: ${$(h.assignedToLabel)}</div>
          </div>
        `).join("")}
      </div>`}function v(l){if(!d)return;const h=i.exportService.export(d.transcription,l),m=l==="md"?"md":l,T=l==="md"?"text/markdown":l==="vtt"?"text/vtt":"text/plain",M=new Blob([h],{type:T}),D=URL.createObjectURL(M),N=document.createElement("a");N.href=D,N.download=`${d.title.replace(/\s+/g,"_")}.${m}`,N.click(),URL.revokeObjectURL(D),s.classList.add("hidden")}function L(l){d=l,u="transcript",c.forEach(m=>m.classList.toggle("active",m.dataset.tab==="transcript")),t.textContent=l.title,n.innerHTML=`
      <span>${l.date.toLocaleDateString("es")}</span>
      <span>·</span>
      <span>${p(l.duration)}</span>
      <span>·</span>
      <span>${l.transcription.segments.length} segmentos</span>
    `,r.innerHTML=l.transcription.speakers.map((m,T)=>`
      <span class="speaker-badge" style="background:${x(T)};color:${b(T)}">
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
    `).join(""),o.querySelectorAll("button").forEach(m=>{m.addEventListener("click",()=>v(m.dataset.format))}),w(l)}return{element:e,show:L}}function $(i){const e=document.createElement("div");return e.textContent=i,e.innerHTML}async function F(i,e){const t=await C();return new Promise((n,r)=>{const a=t.transaction(i,"readwrite"),o=a.objectStore(i).put(e);o.onsuccess=()=>n(),o.onerror=()=>r(o.error),a.oncomplete=()=>t.close()})}async function K(i){const e=await C();return new Promise((t,n)=>{const r=e.transaction(i,"readonly"),s=r.objectStore(i).getAll();s.onsuccess=()=>t(s.result),s.onerror=()=>n(s.error),r.oncomplete=()=>e.close()})}class A extends Error{constructor(e,t){super(e),this.code=t,this.name="AudioCaptureError"}}class Y{constructor(){this.recordings=new Map}async startRecording(e){let t;try{t=await navigator.mediaDevices.getUserMedia({audio:!0})}catch(c){const d=c instanceof Error?c.message:String(c);throw d.includes("Permission denied")||d.includes("NotAllowedError")?new A("Microphone permission denied by user","PERMISSION_DENIED"):new A(`Microphone not available: ${d}`,"MICROPHONE_NOT_AVAILABLE")}const n=crypto.randomUUID(),r={id:n,startedAt:new Date,source:e.source,status:"recording"},a=new MediaRecorder(t),s=[],o={session:r,config:e,mediaStream:t,mediaRecorder:a,chunks:s,startTimestamp:Date.now()};a.ondataavailable=c=>{c.data.size>0&&s.push(c.data)};for(const c of t.getTracks())c.onended=()=>{o.session.status==="recording"&&(o.session.status="stopped",a.stop())};return a.onerror=()=>{o.session.status="stopped",this.stopTracks(t)},a.start(),this.recordings.set(n,o),{...r}}async stopRecording(e){const t=this.recordings.get(e);if(!t)throw new A(`No recording found for session ${e}`,"SESSION_NOT_FOUND");if(t.session.status==="stopped")throw new A(`Recording ${e} is already stopped`,"ALREADY_STOPPED");const n=await this.finalizeRecorder(t);t.session.status="stopped",this.stopTracks(t.mediaStream);const r=(Date.now()-t.startTimestamp)/1e3,a={id:e,blob:n,duration:r,recordedAt:t.session.startedAt,source:t.config.source,language:t.config.language,syncStatus:"pending"};return await F(E.AUDIO_FILES,a),this.recordings.delete(e),a}getStatus(e){const t=this.recordings.get(e);if(!t)throw new A(`No recording found for session ${e}`,"SESSION_NOT_FOUND");const n=(Date.now()-t.startTimestamp)/1e3;return{isRecording:t.session.status==="recording",duration:n,source:t.config.source}}finalizeRecorder(e){return new Promise(t=>{const{mediaRecorder:n,chunks:r}=e;if(n.state==="inactive"){t(new Blob(r,{type:"audio/webm"}));return}n.onstop=()=>{t(new Blob(r,{type:"audio/webm"}))},n.stop()})}stopTracks(e){for(const t of e.getTracks())t.stop()}}class z extends Error{constructor(e,t){super(e),this.code=t,this.name="STTError"}}class Z{constructor(){this.loaded=!1}async load(){this.loaded=!0}isLoaded(){return this.loaded}async transcribe(e,t,n){const r=n??(e.size>0?Math.max(1,e.size/16e3):0);if(r<=0)return[];const a=5,s=Math.max(1,Math.ceil(r/a)),o=[],d={es:["Bienvenidos a la reunión de hoy.","Vamos a revisar los puntos pendientes.","El siguiente tema es importante.","Necesitamos tomar una decisión al respecto.","Perfecto, pasemos al siguiente punto."],en:["Welcome to today's meeting.","Let's review the pending items.","The next topic is important.","We need to make a decision on this.","Great, let's move on to the next point."]}[t];for(let u=0;u<s;u++){const p=u*a,f=Math.min((u+1)*a,r);o.push({startTime:p,endTime:f,text:d[u%d.length],confidence:.75+Math.random()*.2})}return o}}class Q{constructor(e){this.backend=e??new Z}async loadModel(){await this.backend.load()}isReady(){return this.backend.isLoaded()}async transcribe(e,t){if(!this.isReady())throw new z("STT model is not loaded. Call loadModel() first.","MODEL_NOT_LOADED");const n=t??e.language;if(!n)throw new z("Could not determine audio language. Provide a language explicitly.","LANGUAGE_NOT_DETECTED");const r=await this.backend.transcribe(e.blob,n);if(r.length===0)throw new z("Transcription produced no segments — audio may contain no detectable speech.","EMPTY_TRANSCRIPTION");return{segments:r,language:n,duration:e.duration}}}class X extends Error{constructor(e,t){super(e),this.code=t,this.name="DiarizationError"}}const J=.5,R="speaker_unknown",ee="Hablante no identificado";class te{constructor(e=3){this.speakerCount=e}async assignSpeakers(e,t){return t.map((n,r)=>({speakerId:`speaker_${r%this.speakerCount+1}`,confidence:n.confidence}))}}const ne=[/\b(?:hola|buenos días|buenas tardes|buenas noches)?\s*,?\s*soy\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i,/\bmi nombre es\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i,/\bme llamo\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i,/\b(?:hi|hello|hey)?\s*,?\s*I'?m\s+([A-Z][a-z]+)/i,/\bmy name is\s+([A-Z][a-z]+)/i];function re(i){for(const e of ne){const t=i.match(e);if(t!=null&&t[1])return t[1]}}class ae{constructor(e){this.backend=e??new te}async diarize(e,t){if(t.length===0)throw new X("Cannot diarize: no transcription segments provided.","NO_SEGMENTS");const n=await this.backend.assignSpeakers(e,t),r=new Map;let a=1;const s=t.map((d,u)=>{const p=n[u],f=p.confidence<J,b=f?R:p.speakerId,x=p.confidence;!f&&!r.has(b)&&r.set(b,a++);const w=r.get(b),k=f?ee:`Hablante ${w}`;return{...d,speakerId:b,speakerLabel:k,speakerConfidence:x}}),o=new Map;for(const d of s){if(d.speakerId===R)continue;const u=re(d.text);u&&!o.has(d.speakerId)&&o.set(d.speakerId,u);const p=o.get(d.speakerId);p&&(d.speakerLabel=p)}const c=[];for(const[d,u]of r){const p=o.get(d);c.push({id:d,label:p??`Hablante ${u}`,identifiedName:p})}return{segments:s,speakers:c,language:e.language}}}const se="unassigned",ie="Sin asignar",oe={es:{presupuesto:"Presupuesto",costo:"Costos",costos:"Costos",gasto:"Costos",proyecto:"Proyecto",plazo:"Plazos",plazos:"Plazos",fecha:"Plazos",deadline:"Plazos",diseño:"Diseño",cliente:"Cliente",clientes:"Cliente",equipo:"Equipo",estrategia:"Estrategia",marketing:"Marketing",ventas:"Ventas",producto:"Producto",desarrollo:"Desarrollo",tecnología:"Tecnología",problema:"Problemas",riesgo:"Riesgos",contrato:"Contratos"},en:{budget:"Budget",cost:"Costs",costs:"Costs",expense:"Costs",project:"Project",deadline:"Deadlines",timeline:"Deadlines",schedule:"Deadlines",design:"Design",client:"Client",clients:"Client",team:"Team",strategy:"Strategy",marketing:"Marketing",sales:"Sales",product:"Product",development:"Development",technology:"Technology",issue:"Issues",risk:"Risks",contract:"Contracts"}},ce={es:[/\b(?:hay que|necesitamos|debemos|tenemos que|se debe|se necesita)\s+(.+)/i,/\b(?:me comprometo a|voy a|me encargo de)\s+(.+)/i,/\b(?:por favor|favor)\s+(.+)/i,/\b(?:tarea|acción|pendiente|accionable):\s*(.+)/i,/\b(?:queda pendiente)\s+(.+)/i],en:[/\b(?:we need to|we should|we must|we have to|need to)\s+(.+)/i,/\b(?:I will|I'll|I'm going to|I am going to)\s+(.+)/i,/\b(?:please)\s+(.+)/i,/\b(?:action item|task|todo|to-do):\s*(.+)/i,/\b(?:let's)\s+(.+)/i]},de={es:[/\b(?:se decidió|decidimos|se acordó|acordamos|se aprobó|aprobamos)\s+(.+)/i,/\b(?:la decisión es|la decisión fue)\s+(.+)/i,/\b(?:queda aprobado|queda decidido)\s+(.+)/i,/\b(?:se resolvió|resolvimos)\s+(.+)/i],en:[/\b(?:we decided|it was decided|we agreed|it was agreed)\s+(.+)/i,/\b(?:the decision is|the decision was)\s+(.+)/i,/\b(?:we resolved|it was resolved|we approved)\s+(.+)/i,/\b(?:let's go with|we'll go with)\s+(.+)/i]};class le{extractTopics(e,t){const n=oe[t],r=new Set;for(const a of e){const s=a.text.toLowerCase().split(/\s+/);for(const o of s){const c=o.replace(/[.,;:!?()]/g,"");n[c]&&r.add(n[c])}}return Array.from(r)}extractKeyPoints(e,t){const n=[],r=t==="es"?["importante","clave","decisión","acordamos","conclusión","resumen"]:["important","key","decision","agreed","conclusion","summary"];for(const a of e){const s=a.text.toLowerCase();r.some(o=>s.includes(o))&&n.push(a.text.trim())}return n}detectActionItems(e,t){const n=ce[t],r=[];for(let a=0;a<e.length;a++){const s=e[a].text;for(const o of n){const c=s.match(o);if(c!=null&&c[1]){r.push({description:c[1].trim(),segmentIndex:a});break}}}return r}detectDecisions(e,t){const n=de[t],r=[];for(const a of e)for(const s of n){const o=a.text.match(s);if(o!=null&&o[1]){r.push(o[1].trim());break}}return r}}let pe=1;function ue(){return`action_${pe++}`}class ge{constructor(e){this.backend=e??new le}async generateSummary(e){const{segments:t,language:n}=e,r=this.backend.extractTopics(t,n),a=this.backend.extractKeyPoints(t,n);return r.length===0&&r.push(n==="es"?"Discusión general":"General discussion"),{topics:r,keyPoints:a,language:n}}async generateMinutes(e,t,n){const{segments:r,speakers:a,language:s}=e,o=this.backend.detectDecisions(r,s);return{title:t.topics.length>0?s==="es"?`Acta: ${t.topics[0]}`:`Minutes: ${t.topics[0]}`:s==="es"?"Acta de reunión":"Meeting Minutes",date:new Date,attendees:a,topicsDiscussed:t.topics,decisions:o,actionItems:n,language:s}}async extractActionItems(e){const{segments:t,speakers:n,language:r}=e,a=this.backend.detectActionItems(t,r),s=new Map;for(const o of n)s.set(o.id,o);return a.map(o=>{const c=t[o.segmentIndex],d=c?s.get(c.speakerId):void 0,u=d!==void 0;return{id:ue(),description:o.description,assignedTo:u?d.id:se,assignedToLabel:u?d.identifiedName??d.label:ie,sourceSegmentId:c==null?void 0:c.speakerId}})}}class fe{export(e,t){if(!e||!e.segments)throw new Error("Export failed: transcription data is corrupted or missing segments.");switch(t){case"vtt":return this.exportVTT(e);case"txt":return this.exportTXT(e);case"md":return this.exportMarkdown(e);default:throw new Error(`Unsupported export format: ${t}`)}}importVTT(e){if(!e||typeof e!="string")throw new Error("Import failed: VTT content is empty or invalid.");const t=e.split(`
`);if(!t[0]||!t[0].trim().startsWith("WEBVTT"))throw new Error("Import failed: missing WEBVTT header at line 1.");const n=[],r=new Map;let a=1;for(;a<t.length&&t[a].trim()!=="";)a++;for(;a<t.length;){if(t[a].trim()===""){a++;continue}const c=t[a].trim();if(a++,a>=t.length)throw new Error(`Import failed: unexpected end of file after cue identifier at line ${a}.`);const d=t[a].trim(),u=d.match(/^(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})$/);if(!u)throw new Error(`Import failed: malformed timestamp at line ${a+1}: "${d}".`);a++;const p=this.parseVTTTimestamp(u[1]),f=this.parseVTTTimestamp(u[2]),b=[];for(;a<t.length&&t[a].trim()!=="";)b.push(t[a].trim()),a++;if(b.length===0)throw new Error(`Import failed: missing cue text after timestamp at line ${a}.`);const x=b.join(" "),w=c.match(/^(speaker_\d+)\s*-\s*(.+)$/);let k,I;w?(k=w[1],I=w[2]):(k=c,I=c),r.has(k)||r.set(k,{id:k,label:I}),n.push({startTime:p,endTime:f,text:x,confidence:1,speakerId:k,speakerLabel:I,speakerConfidence:1})}const s=t[0].match(/Language:\s*(es|en)/i),o=s?s[1]:"es";return{segments:n,speakers:Array.from(r.values()),language:o}}exportVTT(e){const t=`WEBVTT - Language: ${e.language}`,n=e.segments.map(r=>{const a=this.formatVTTTimestamp(r.startTime),s=this.formatVTTTimestamp(r.endTime);return`${`${r.speakerId} - ${r.speakerLabel}`}
${a} --> ${s}
${r.text}`});return[t,"",...n].join(`

`)}exportTXT(e){return e.segments.map(t=>{const n=this.formatTimestamp(t.startTime),r=this.formatTimestamp(t.endTime);return`[${n} - ${r}] ${t.speakerLabel}: ${t.text}`}).join(`
`)}exportMarkdown(e){const t=["# Transcription",""];for(const n of e.segments){const r=this.formatTimestamp(n.startTime),a=this.formatTimestamp(n.endTime);t.push(`**${n.speakerLabel}** _(${r} - ${a})_`),t.push(""),t.push(n.text),t.push("")}return t.join(`
`)}formatVTTTimestamp(e){const t=Math.floor(e/3600),n=Math.floor(e%3600/60),r=Math.floor(e%60),a=Math.round((e-Math.floor(e))*1e3);return String(t).padStart(2,"0")+":"+String(n).padStart(2,"0")+":"+String(r).padStart(2,"0")+"."+String(a).padStart(3,"0")}parseVTTTimestamp(e){const t=e.split(":"),n=parseInt(t[0],10),r=parseInt(t[1],10),a=t[2].split("."),s=parseInt(a[0],10),o=parseInt(a[1],10);return n*3600+r*60+s+o/1e3}formatTimestamp(e){const t=Math.floor(e/3600),n=Math.floor(e%3600/60),r=Math.floor(e%60);return String(t).padStart(2,"0")+":"+String(n).padStart(2,"0")+":"+String(r).padStart(2,"0")}}class me{constructor(){this.audioCapture=new Y,this.exportService=new fe,this.meetings=[],this.currentSessionId=null,this.recordingStartTime=0,this.sttEngine=new Q,this.diarization=new ae,this.nlpService=new ge}async init(){await this.sttEngine.loadModel(),await this.loadMeetingsFromDB()}async startRecording(e="es"){const t=await this.audioCapture.startRecording({source:"microphone",language:e});return this.currentSessionId=t.id,this.recordingStartTime=Date.now(),t.id}get activeSessionId(){return this.currentSessionId}async stopAndProcess(e){if(!this.currentSessionId)throw new Error("No active recording session");const t=this.currentSessionId;this.currentSessionId=null;const n=await this.audioCapture.stopRecording(t),r=await this.sttEngine.transcribe(n),a=await this.diarization.diarize(n,r.segments),s=await this.nlpService.generateSummary(a),o=await this.nlpService.extractActionItems(a),c=await this.nlpService.generateMinutes(a,s,o),d={id:n.id,status:"local",transcription:a,audioId:n.id,createdAt:Date.now(),updatedAt:Date.now()};await F(E.TRANSCRIPTIONS,d);const u=e??`Reunión ${new Date().toLocaleString("es")}`,p={id:n.id,title:u,date:n.recordedAt,duration:n.duration,status:"transcribed",transcription:a,summary:s,actionItems:o,minutes:c};return this.meetings.unshift(p),{transcriptionId:n.id,audioFile:n,transcription:a,summary:s,actionItems:o,minutes:c}}getMeetings(){return this.meetings}getMeeting(e){return this.meetings.find(t=>t.id===e)}async loadMeetingsFromDB(){try{const e=await K(E.TRANSCRIPTIONS);for(const t of e){const n=await this.nlpService.generateSummary(t.transcription),r=await this.nlpService.extractActionItems(t.transcription),a=await this.nlpService.generateMinutes(t.transcription,n,r);this.meetings.push({id:t.id,title:`Reunión ${new Date(t.createdAt).toLocaleString("es")}`,date:new Date(t.createdAt),duration:t.transcription.segments.length>0?t.transcription.segments[t.transcription.segments.length-1].endTime:0,status:"transcribed",transcription:t.transcription,summary:n,actionItems:r,minutes:a})}this.meetings.sort((t,n)=>n.date.getTime()-t.date.getTime())}catch{}}}const he=[{id:"home",icon:y.house,label:"Inicio"},{id:"search",icon:y.search,label:"Buscar"},{id:"calendar",icon:y.calendar,label:"Calendario"},{id:"settings",icon:y.settings,label:"Ajustes"}];function xe(){q();const i=new me;i.init().catch(console.error);let e=null;const t=document.createElement("div");t.id="app-shell",t.style.cssText="display:flex;flex-direction:column;min-height:100vh;";const n=H({onRecordClick:()=>w(),onSearchClick:()=>x("search"),onMeetingClick:g=>I(g),getMeetings:()=>i.getMeetings()}),r=U({onBack:()=>k(),onStop:()=>k(),onPause:()=>{},onFlag:()=>{}}),a=W(),s=G({onBack:()=>{n.refresh(),x("home")},exportService:i.exportService}),o=document.createElement("div");o.className="screen",o.style.cssText="padding-bottom:0;",o.innerHTML=`
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
        Transcribiendo audio, identificando hablantes y generando resumen.
      </div>
    </div>
    <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
  `;const c=document.createElement("div");c.className="screen",c.innerHTML=`
    <div class="settings-screen">
      <div class="settings-title">Calendario</div>
      <p style="color:var(--text-secondary);font-size:14px;">Próximamente: integración con Google Calendar y Microsoft Teams.</p>
    </div>`;const d=document.createElement("div");d.className="screen",d.innerHTML=`
    <div class="settings-screen">
      <div class="settings-title">Ajustes</div>
      <p style="color:var(--text-secondary);font-size:14px;">Configuración de cuenta, idioma y preferencias.</p>
    </div>`;const u=new Map([["home",n.element],["search",a.element],["calendar",c],["settings",d],["recording",r.element],["processing",o],["detail",s.element]]);u.forEach(g=>t.appendChild(g));const p=document.createElement("nav");p.className="nav-bar",p.setAttribute("role","navigation"),p.setAttribute("aria-label","Navegación principal");const f=new Map;he.forEach(g=>{const v=document.createElement("button");v.className="nav-item",v.type="button",v.innerHTML=`${g.icon}<span>${g.label}</span>`,v.setAttribute("aria-label",g.label),v.addEventListener("click",()=>x(g.id)),f.set(g.id,v),p.appendChild(v)}),t.appendChild(p);const b=["recording","processing","detail"];function x(g){u.forEach((v,L)=>{v.classList.toggle("active",L===g)}),p.style.display=b.includes(g)?"none":"flex",f.forEach((v,L)=>{v.classList.toggle("active",L===g)})}async function w(){try{await i.startRecording("es"),x("recording"),r.reset();let g=0;e=setInterval(()=>{g++,r.updateTimer(g),r.animateWaveform()},1e3)}catch(g){const v=g instanceof Error?g.message:String(g);alert(`No se pudo iniciar la grabación: ${v}`)}}async function k(){if(e&&(clearInterval(e),e=null),!i.activeSessionId){x("home");return}x("processing");try{const g=await i.stopAndProcess(),v=i.getMeeting(g.transcriptionId);v?(s.show(v),x("detail")):(n.refresh(),x("home"))}catch(g){console.error("Processing failed:",g),alert(`Error al procesar la grabación: ${g instanceof Error?g.message:String(g)}`),n.refresh(),x("home")}}function I(g){const v=i.getMeeting(g);v&&(s.show(v),x("detail"))}return x("home"),{root:t,navigateTo:x}}async function ve(){await C(),await O();const i=document.getElementById("app");if(!i)return;const e=xe();i.appendChild(e.root)}ve().catch(console.error);
//# sourceMappingURL=main-BWy_84Ud.js.map
