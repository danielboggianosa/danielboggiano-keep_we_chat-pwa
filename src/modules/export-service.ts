/**
 * ExportService — Export transcriptions to VTT, TXT, and Markdown formats,
 * and import from VTT.
 *
 * Requisitos: 10.1, 10.2, 10.3, 10.4
 */

import type { ExportFormat } from '../types/export';
import type { DiarizedSegment, DiarizedTranscription, SpeakerProfile } from '../types/transcription';

export class ExportService {
  /**
   * Export a diarized transcription to the specified format.
   * Includes speaker labels, timestamps, and text for each segment.
   */
  export(transcription: DiarizedTranscription, format: ExportFormat): string {
    if (!transcription || !transcription.segments) {
      throw new Error('Export failed: transcription data is corrupted or missing segments.');
    }

    switch (format) {
      case 'vtt':
        return this.exportVTT(transcription);
      case 'txt':
        return this.exportTXT(transcription);
      case 'md':
        return this.exportMarkdown(transcription);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Import a VTT file and produce a DiarizedTranscription.
   * Throws on malformed VTT content.
   */
  importVTT(vttContent: string): DiarizedTranscription {
    if (!vttContent || typeof vttContent !== 'string') {
      throw new Error('Import failed: VTT content is empty or invalid.');
    }

    const lines = vttContent.split('\n');

    // Validate WEBVTT header
    if (!lines[0] || !lines[0].trim().startsWith('WEBVTT')) {
      throw new Error('Import failed: missing WEBVTT header at line 1.');
    }

    const segments: DiarizedSegment[] = [];
    const speakerMap = new Map<string, SpeakerProfile>();
    let i = 1; // skip WEBVTT header

    // Skip header metadata lines until first blank line
    while (i < lines.length && lines[i].trim() !== '') {
      i++;
    }

    while (i < lines.length) {
      // Skip blank lines
      if (lines[i].trim() === '') {
        i++;
        continue;
      }

      // Expect cue identifier (speaker label)
      const cueId = lines[i].trim();
      i++;

      if (i >= lines.length) {
        throw new Error(`Import failed: unexpected end of file after cue identifier at line ${i}.`);
      }

      // Expect timestamp line: "HH:MM:SS.mmm --> HH:MM:SS.mmm"
      const timestampLine = lines[i].trim();
      const timestampMatch = timestampLine.match(
        /^(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})$/,
      );
      if (!timestampMatch) {
        throw new Error(`Import failed: malformed timestamp at line ${i + 1}: "${timestampLine}".`);
      }
      i++;

      const startTime = this.parseVTTTimestamp(timestampMatch[1]);
      const endTime = this.parseVTTTimestamp(timestampMatch[2]);

      // Collect text lines until blank line or end of file
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].trim());
        i++;
      }

      if (textLines.length === 0) {
        throw new Error(`Import failed: missing cue text after timestamp at line ${i}.`);
      }

      const text = textLines.join(' ');

      // Parse speaker from cue identifier: "speaker_N - Label"
      const speakerMatch = cueId.match(/^(speaker_\d+)\s*-\s*(.+)$/);
      let speakerId: string;
      let speakerLabel: string;

      if (speakerMatch) {
        speakerId = speakerMatch[1];
        speakerLabel = speakerMatch[2];
      } else {
        // Fallback: use cue id as speaker id
        speakerId = cueId;
        speakerLabel = cueId;
      }

      if (!speakerMap.has(speakerId)) {
        speakerMap.set(speakerId, {
          id: speakerId,
          label: speakerLabel,
        });
      }

      segments.push({
        startTime,
        endTime,
        text,
        confidence: 1,
        speakerId,
        speakerLabel,
        speakerConfidence: 1,
      });
    }

    // Detect language from header or default to 'es'
    const languageMatch = lines[0].match(/Language:\s*(es|en)/i);
    const language: 'es' | 'en' = languageMatch ? (languageMatch[1] as 'es' | 'en') : 'es';

    return {
      segments,
      speakers: Array.from(speakerMap.values()),
      language,
    };
  }

  // ── Private format methods ──────────────────────────────────────

  private exportVTT(transcription: DiarizedTranscription): string {
    const header = `WEBVTT - Language: ${transcription.language}`;
    const cues = transcription.segments.map((seg) => {
      const start = this.formatVTTTimestamp(seg.startTime);
      const end = this.formatVTTTimestamp(seg.endTime);
      const cueId = `${seg.speakerId} - ${seg.speakerLabel}`;
      return `${cueId}\n${start} --> ${end}\n${seg.text}`;
    });

    return [header, '', ...cues].join('\n\n');
  }

  private exportTXT(transcription: DiarizedTranscription): string {
    return transcription.segments
      .map((seg) => {
        const start = this.formatTimestamp(seg.startTime);
        const end = this.formatTimestamp(seg.endTime);
        return `[${start} - ${end}] ${seg.speakerLabel}: ${seg.text}`;
      })
      .join('\n');
  }

  private exportMarkdown(transcription: DiarizedTranscription): string {
    const lines: string[] = ['# Transcription', ''];

    for (const seg of transcription.segments) {
      const start = this.formatTimestamp(seg.startTime);
      const end = this.formatTimestamp(seg.endTime);
      lines.push(`**${seg.speakerLabel}** _(${start} - ${end})_`);
      lines.push('');
      lines.push(seg.text);
      lines.push('');
    }

    return lines.join('\n');
  }

  // ── Timestamp helpers ───────────────────────────────────────────

  /** Format seconds to VTT timestamp: HH:MM:SS.mmm */
  private formatVTTTimestamp(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
    return (
      String(h).padStart(2, '0') +
      ':' +
      String(m).padStart(2, '0') +
      ':' +
      String(s).padStart(2, '0') +
      '.' +
      String(ms).padStart(3, '0')
    );
  }

  /** Parse VTT timestamp HH:MM:SS.mmm to seconds. */
  private parseVTTTimestamp(ts: string): number {
    const parts = ts.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const secParts = parts[2].split('.');
    const s = parseInt(secParts[0], 10);
    const ms = parseInt(secParts[1], 10);
    return h * 3600 + m * 60 + s + ms / 1000;
  }

  /** Format seconds to human-readable: HH:MM:SS */
  private formatTimestamp(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return (
      String(h).padStart(2, '0') +
      ':' +
      String(m).padStart(2, '0') +
      ':' +
      String(s).padStart(2, '0')
    );
  }
}
