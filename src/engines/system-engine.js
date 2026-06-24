// readalong-reader — System (Web Speech API) engine
// Copyright (C) 2026 Bruno Silva
// Licensed under the GNU GPL v3.0 or later. See LICENSE.
//
// Zero-dependency engine using the browser's built-in speechSynthesis.
// Provides EXACT per-word highlighting via the `boundary` event.

import { TTSEngine } from './base.js';

export class SystemEngine extends TTSEngine {
  constructor() {
    super();
    this._synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this._voices = [];
    this._token = 0;
    this._load();
    if (this._synth && typeof this._synth.onvoiceschanged !== 'undefined') {
      this._synth.onvoiceschanged = () => this._load();
    }
  }

  get id() { return 'system'; }
  get exactWordTiming() { return true; }

  _load() { this._voices = this._synth ? this._synth.getVoices() : []; }

  async listVoices() {
    this._load();
    const order = this._voices
      .map((v, i) => ({ v, i }))
      .sort((a, b) => {
        const ae = /^en/i.test(a.v.lang) ? 0 : 1;
        const be = /^en/i.test(b.v.lang) ? 0 : 1;
        return ae !== be ? ae - be : a.v.name.localeCompare(b.v.name);
      });
    return order.map(({ v, i }) => ({ id: String(i), label: `${v.name} (${v.lang})` }));
  }

  /** Suggest a pleasant default voice id, or null. */
  defaultVoice() {
    const prefer = ['Samantha', 'Google US English', 'Microsoft Aria', 'Karen', 'Daniel'];
    for (const n of prefer) {
      const k = this._voices.findIndex(v => v.name.indexOf(n) >= 0);
      if (k >= 0) return String(k);
    }
    const en = this._voices.findIndex(v => /^en/i.test(v.lang));
    return en >= 0 ? String(en) : (this._voices.length ? '0' : null);
  }

  async prepare() { /* nothing to preload */ }

  speak(utterance, opts = {}) {
    if (!this._synth) { opts.onError && opts.onError(new Error('speechSynthesis unavailable')); return; }
    const tk = ++this._token;
    const u = new SpeechSynthesisUtterance(utterance.text);
    const idx = parseInt(opts.voice, 10);
    if (!isNaN(idx) && this._voices[idx]) u.voice = this._voices[idx];
    u.rate = opts.rate || 1;
    u.pitch = 1;

    // Map each word to its character offset within the utterance text.
    const offs = [];
    let pos = 0;
    utterance.words.forEach(w => {
      const f = utterance.text.indexOf(w.text, pos);
      const st = f < 0 ? pos : f;
      offs.push(st);
      pos = st + w.text.length;
    });

    u.onboundary = ev => {
      if (tk !== this._token) return;
      if (ev.name && ev.name !== 'word') return;
      let k = -1;
      for (let j = 0; j < offs.length; j++) { if (offs[j] <= ev.charIndex) k = j; else break; }
      if (k >= 0 && opts.onWord) opts.onWord(k);
    };
    u.onend = () => { if (tk === this._token && opts.onEnd) opts.onEnd(); };
    u.onerror = () => { if (tk === this._token && opts.onError) opts.onError(new Error('speech synthesis error')); };

    this._synth.speak(u);
  }

  pause() { try { this._synth && this._synth.pause(); } catch (e) {} }
  resume() { try { this._synth && this._synth.resume(); } catch (e) {} }
  stop() { this._token++; try { this._synth && this._synth.cancel(); } catch (e) {} }
  dispose() { this.stop(); }
}
