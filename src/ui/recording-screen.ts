/**
 * Active recording screen matching the Pencil design "Grabación Activa".
 * Shows timer, waveform animation, live transcript, and controls.
 */

import { icons } from './icons';

interface RecordingScreenCallbacks {
  onBack: () => void;
  onStop: () => void;
  onPause: () => void;
  onFlag: () => void;
}

export interface RecordingScreenAPI {
  element: HTMLElement;
  reset: () => void;
  updateTimer: (seconds: number) => void;
  animateWaveform: () => void;
  addTranscriptLine: (speaker: string, text: string, color: string) => void;
  updateInterim: (text: string) => void;
  updateSpeakerInfo: (text: string) => void;
}

export function createRecordingScreen(cb: RecordingScreenCallbacks): RecordingScreenAPI {
  const el = document.createElement('div');
  el.className = 'screen';
  el.style.cssText = 'padding-bottom:0;';

  const BAR_COUNT = 15;

  el.innerHTML = `
    <!-- Header -->
    <div class="rec-header">
      <button class="rec-back" type="button" id="rec-back">
        ${icons.arrowLeft}
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
        ${Array.from({ length: BAR_COUNT }, () => '<div class="bar" style="height:20px"></div>').join('')}
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
        ${icons.pause}
      </button>
      <button class="rec-ctrl-btn stop" type="button" id="rec-stop" aria-label="Detener grabación">
        ${icons.square}
      </button>
      <button class="rec-ctrl-btn secondary" type="button" id="rec-flag" aria-label="Marcar momento">
        ${icons.flag}
      </button>
    </div>
  `;

  const timerEl = el.querySelector('#rec-timer') as HTMLElement;
  const waveformEl = el.querySelector('#rec-waveform') as HTMLElement;
  const bars = waveformEl.querySelectorAll('.bar') as NodeListOf<HTMLElement>;
  const transcriptLines = el.querySelector('#rec-transcript-lines') as HTMLElement;
  const speakerTextEl = el.querySelector('.rec-speaker-text') as HTMLElement;

  const interimEl = el.querySelector('#rec-interim') as HTMLElement;
  const interimTextEl = interimEl.querySelector('.rec-lt-text') as HTMLElement;

  el.querySelector('#rec-back')!.addEventListener('click', cb.onBack);
  el.querySelector('#rec-stop')!.addEventListener('click', cb.onStop);
  el.querySelector('#rec-pause')!.addEventListener('click', cb.onPause);
  el.querySelector('#rec-flag')!.addEventListener('click', cb.onFlag);

  function formatTime(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  }

  function reset(): void {
    timerEl.textContent = '00:00:00';
    transcriptLines.innerHTML = '';
    bars.forEach(b => { b.style.height = '20px'; });
  }

  function updateTimer(seconds: number): void {
    timerEl.textContent = formatTime(seconds);
  }

  function animateWaveform(): void {
    bars.forEach(b => {
      const h = 10 + Math.random() * 50;
      b.style.height = `${h}px`;
    });
  }

  function addTranscriptLine(speaker: string, text: string, color: string): void {
    // Hide interim when a final segment arrives
    interimEl.style.display = 'none';

    const line = document.createElement('div');
    line.className = 'rec-lt-line';
    line.innerHTML = `
      <span class="rec-lt-speaker" style="color:${color}">${speaker}:</span>
      <span class="rec-lt-text">${text}</span>
    `;
    transcriptLines.appendChild(line);
    // Keep only last 5 lines
    while (transcriptLines.children.length > 5) {
      transcriptLines.removeChild(transcriptLines.firstChild!);
    }
  }

  function updateInterim(text: string): void {
    if (text) {
      interimTextEl.textContent = text;
      interimEl.style.display = 'flex';
    } else {
      interimEl.style.display = 'none';
    }
  }

  function updateSpeakerInfo(text: string): void {
    speakerTextEl.textContent = text;
  }

  return { element: el, reset, updateTimer, animateWaveform, addTranscriptLine, updateInterim, updateSpeakerInfo };
}
