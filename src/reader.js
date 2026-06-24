// readalong-reader — <read-along-reader> custom element + ReadAlongReader class
// Copyright (C) 2026 Bruno Silva
// Licensed under the GNU GPL v3.0 or later. See LICENSE.

import { CSS } from './styles.js';
import { splitSentences, parseMarkdown, parsePasted } from './parse.js';
import { SystemEngine } from './engines/system-engine.js';
import { KokoroEngine } from './engines/kokoro-engine.js';

const TEMPLATE = /* html */ `
<style>${CSS}</style>
<div class="bar" role="region" aria-label="Reader controls">
  <div class="bar-inner">
    <button class="play-btn" part="play" id="play" aria-label="Play">▶ Play</button>
    <button class="icon-btn" id="restart" aria-label="Restart from beginning" title="Restart">↺</button>
    <button class="icon-btn" id="stop" aria-label="Stop" title="Stop">■</button>
    <div class="spacer"></div>
    <button class="toggle" id="loadToggle" aria-expanded="false">✎ Article</button>
    <button class="toggle" id="setToggle" aria-expanded="false">⚙ Settings</button>
  </div>

  <div class="status" id="status" role="status" aria-live="polite">
    <div class="status-inner"><div class="spin" id="spin"></div><span id="statusText"></span></div>
  </div>

  <div class="drawer" id="settings">
    <div class="grid">
      <div class="field">
        <label id="lblEngine">Voice engine</label>
        <div class="seg" role="group" aria-labelledby="lblEngine" id="engineSeg">
          <button data-engine="system" aria-pressed="true">System (fast)</button>
          <button data-engine="kokoro" aria-pressed="false">Natural (local)</button>
        </div>
      </div>
      <div class="field">
        <label for="voiceSel">Voice</label>
        <select id="voiceSel"></select>
      </div>
      <div class="field">
        <label for="rate">Speed · <span class="val" id="rateVal">1.0×</span></label>
        <input type="range" id="rate" min="0.6" max="1.6" step="0.05" value="1" aria-label="Speed">
      </div>
      <div class="field">
        <label id="lblSize">Text size</label>
        <div class="seg" role="group" aria-labelledby="lblSize" id="sizeSeg">
          <button data-size="18">A−</button><button data-size="21" aria-pressed="true">A</button>
          <button data-size="25">A+</button><button data-size="30">A++</button>
        </div>
      </div>
      <div class="field">
        <label id="lblTheme">Theme</label>
        <div class="seg" role="group" aria-labelledby="lblTheme" id="themeSeg">
          <button data-theme="warm" aria-pressed="true">Warm</button><button data-theme="dark">Dark</button>
          <button data-theme="sepia">Sepia</button><button data-theme="contrast">High</button>
        </div>
      </div>
      <div class="field">
        <label id="lblLh">Line spacing</label>
        <div class="seg" role="group" aria-labelledby="lblLh" id="lhSeg">
          <button data-lh="1.6">Tight</button><button data-lh="1.9" aria-pressed="true">Roomy</button>
          <button data-lh="2.3">Airy</button>
        </div>
      </div>
      <div class="field">
        <label id="lblFocus">Focus dimming</label>
        <div class="seg" role="group" aria-labelledby="lblFocus" id="focusSeg">
          <button data-focus="1" aria-pressed="true">On</button><button data-focus="0">Off</button>
        </div>
      </div>
    </div>
  </div>

  <div class="drawer" id="loader">
    <div class="loader-body">
      <label class="mini-label" for="pasteBox">Paste Markdown or text</label>
      <textarea id="pasteBox" placeholder="Paste an article as Markdown or plain text…"></textarea>
      <div class="hint">Headings (# / ##) become section titles. The reader makes no network calls — it reads exactly what you give it.</div>
      <div class="row">
        <button class="primary" id="loadBtn">Load</button>
        <button class="icon-btn" id="loadCancel">Cancel</button>
      </div>
    </div>
  </div>
</div>
<article class="article" id="article" aria-live="off"></article>
`;

export class ReadAlongReader extends HTMLElement {
  static get observedAttributes() { return ['engine', 'theme', 'focus', 'rate', 'markdown', 'text', 'kokoro-module']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = TEMPLATE;
    this._$ = id => this.shadowRoot.getElementById(id);

    // state
    this.sentences = [];
    this.current = 0;
    this.state = 'idle';           // idle | playing | paused
    this._token = 0;
    this._engineId = 'system';
    this._voiceId = null;
    this._rate = 1;

    // engines (lazily created)
    this._engines = {};
    this._engine = null;
  }

  /* ---------- lifecycle ---------- */
  connectedCallback() {
    this._wire();
    if (!this.hasAttribute('theme')) this.setAttribute('theme', 'warm');
    if (!this.hasAttribute('focus')) this.setAttribute('focus', '');
    this._engineId = this.getAttribute('engine') || 'system';
    this._setEngineButtons(this._engineId);
    this._useEngine(this._engineId, false);

    const md = this.getAttribute('markdown');
    const text = this.getAttribute('text');
    if (md != null) this.loadMarkdown(md);
    else if (text != null) this.loadText(text);
    else this._renderEmpty();
  }

  disconnectedCallback() { this.stop(); Object.values(this._engines).forEach(e => e.dispose && e.dispose()); }

  attributeChangedCallback(name, _old, val) {
    if (name === 'engine' && val && val !== this._engineId) { this.engine = val; }
    if (name === 'rate' && val) { this._rate = parseFloat(val) || 1; const r = this._$('rate'); if (r) r.value = this._rate; this._setRateLabel(); }
    if (name === 'markdown' && val != null && this.isConnected) this.loadMarkdown(val);
    if (name === 'text' && val != null && this.isConnected) this.loadText(val);
  }

  /* ---------- public API ---------- */
  get engine() { return this._engineId; }
  set engine(v) { if (v === this._engineId) return; this._switchEngine(v); }

  /** Get/set Markdown content (the recommended input format). */
  get markdown() { return this._markdown || ''; }
  set markdown(md) { this._markdown = md; this.loadMarkdown(md); }

  /** Load a normalized doc directly: {eyebrow,title,blocks:[{h2|p}]}. The primitive. */
  loadDoc(doc) { this._render(doc); }
  /** Load Markdown. Headings via #, ##; blank-line separated paragraphs. */
  loadMarkdown(md) { this._render(parseMarkdown(md)); }
  /** Load plain text (heuristic: first short line = title, short lines = headings). */
  loadText(text) { this._render(parsePasted(text)); }
  /** Convenience: accepts a doc object, Markdown, or plain text (auto-detected). */
  load(input) {
    if (input && typeof input === 'object') return this.loadDoc(input);
    const s = String(input == null ? '' : input);
    if (/^#{1,6}\s/m.test(s) || s.includes('Markdown Content:')) return this.loadMarkdown(s);
    return this.loadText(s);
  }

  play() {
    if (!this.sentences.length) return;
    if (this.state === 'paused') { this.state = 'playing'; this._setPlayBtn(); this._engine.resume(); this._emit('play'); return; }
    if (this.state === 'playing') return;
    this.state = 'playing'; this._setPlayBtn();
    if (this.current >= this.sentences.length) this.current = 0;
    this._emit('play');
    this._speak(this.current);
  }
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused'; this._setPlayBtn(); this._engine.pause(); this._emit('pause');
  }
  toggle() { if (this.state === 'playing') this.pause(); else this.play(); }
  stop() { this._hardStop(); this.state = 'idle'; this._setPlayBtn(); this._clearHighlights(); this._emit('stop'); }
  restart() { this.startFrom(0); }
  startFrom(i) { this._hardStop(); this.current = i; this.state = 'playing'; this._setPlayBtn(); this._emit('play'); this._speak(i); }

  /* ---------- rendering ---------- */
  _renderEmpty() {
    this._$('article').innerHTML = '<p class="empty">Paste an article link or some text (✎ Article) to begin.</p>';
    this.sentences = [];
  }
  _fillWords(el, text) {
    const words = [];
    text.split(/(\s+)/).forEach(tok => {
      if (/^\s+$/.test(tok)) el.appendChild(document.createTextNode(tok));
      else if (tok.length) { const w = document.createElement('span'); w.className = 'word'; w.textContent = tok; el.appendChild(w); words.push(w); }
    });
    return words;
  }
  _registerSentence(el, text) {
    const idx = this.sentences.length;
    el.classList.add('sent'); el.dataset.s = idx; el.setAttribute('role', 'button'); el.tabIndex = 0;
    const words = this._fillWords(el, text);
    this.sentences.push({ el, words, text });
    el.addEventListener('click', () => this.startFrom(idx));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.startFrom(idx); } });
  }
  _render(doc) {
    this._hardStop(); this.state = 'idle'; this._setPlayBtn();
    const art = this._$('article');
    art.innerHTML = ''; this.sentences = [];
    if (doc.eyebrow) { const e = document.createElement('div'); e.className = 'eyebrow'; e.textContent = doc.eyebrow; art.appendChild(e); }
    if (doc.title) { const h = document.createElement('h1'); this._registerSentence(h, doc.title); art.appendChild(h); }
    (doc.blocks || []).forEach(block => {
      if (block.h2) { const h = document.createElement('h2'); this._registerSentence(h, block.h2); art.appendChild(h); }
      if (block.p) {
        const p = document.createElement('p');
        splitSentences(block.p).forEach(sen => {
          const span = document.createElement('span');
          this._registerSentence(span, sen);
          span.appendChild(document.createTextNode(' '));
          p.appendChild(span);
        });
        art.appendChild(p);
      }
    });
    this.current = 0;
    this._emit('load', { title: doc.title, sentences: this.sentences.length });
  }

  /* ---------- highlighting ---------- */
  _clearHighlights() { this.sentences.forEach(s => { s.el.classList.remove('active'); s.el.removeAttribute('aria-current'); s.words.forEach(w => w.classList.remove('active')); }); }
  _clearWords(s) { s.words.forEach(w => w.classList.remove('active')); }
  _highlightSentence(i) {
    this.sentences.forEach(s => { s.el.classList.remove('active'); s.el.removeAttribute('aria-current'); });
    const s = this.sentences[i];
    if (s) { s.el.classList.add('active'); s.el.setAttribute('aria-current', 'true'); s.el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    this._emit('sentence', { index: i, text: s ? s.text : '' });
  }
  _highlightWord(s, idx) { s.words.forEach((w, j) => w.classList.toggle('active', j === idx)); }

  /* ---------- engine orchestration ---------- */
  _getEngine(id) {
    if (this._engines[id]) return this._engines[id];
    let eng;
    if (id === 'kokoro') eng = new KokoroEngine({ module: this.getAttribute('kokoro-module') || undefined });
    else eng = new SystemEngine();
    this._engines[id] = eng;
    return eng;
  }
  async _useEngine(id, repopulate = true) {
    this._engineId = id;
    this._engine = this._getEngine(id);
    if (id === 'kokoro') {
      this._engine.prepare(p => this._showStatus('Downloading natural voice… ' + p.progress + '% (one-time, then cached)', true))
        .then(() => { this._populateVoices(); this._hideStatus(); })
        .catch(() => {/* surfaced on play */});
    }
    if (repopulate) await this._populateVoices(); else this._populateVoices();
  }
  async _switchEngine(id) {
    const wasPlaying = this.state === 'playing';
    this._hardStop(); this.state = 'idle'; this._setPlayBtn(); this._clearHighlights();
    this._setEngineButtons(id);
    await this._useEngine(id, true);
    this._emit('enginechange', { engine: id });
    if (wasPlaying) this.startFrom(this.current);
  }

  async _populateVoices() {
    const sel = this._$('voiceSel');
    let voices = [];
    try { voices = await this._engine.listVoices(); } catch (e) {}
    sel.innerHTML = '';
    voices.forEach(v => { const o = document.createElement('option'); o.value = v.id; o.textContent = v.label; sel.appendChild(o); });
    const def = this._engine.defaultVoice ? this._engine.defaultVoice() : (voices[0] && voices[0].id);
    if (def != null) { sel.value = String(def); this._voiceId = String(def); }
    else this._voiceId = null;
  }

  _hardStop() { this._token++; if (this._engine) this._engine.stop(); }

  _speak(i) {
    if (i < 0 || i >= this.sentences.length) { this._finish(); return; }
    const s = this.sentences[i];
    this._highlightSentence(i); this._clearWords(s);
    const tk = this._token;
    const utt = { text: s.text, words: s.words.map(w => ({ text: w.textContent, len: w.textContent.length })) };
    // prefetch the next sentence (engines that support it)
    if (this._engine.prefetch && this.sentences[i + 1]) this._engine.prefetch({ text: this.sentences[i + 1].text, words: [] });
    this._engine.speak(utt, {
      voice: this._voiceId,
      rate: this._rate,
      onWord: idx => { if (tk !== this._token) return; if (idx < 0) this._clearWords(s); else this._highlightWord(s, idx); },
      onEnd: () => { if (tk !== this._token || this.state !== 'playing') return; this._clearWords(s); this.current++; this._speak(this.current); },
      onError: err => { if (tk !== this._token) return; this._onEngineError(err, i); },
      cancelled: () => tk !== this._token,
    });
  }

  _onEngineError(err, i) {
    if (this._engineId === 'kokoro') {
      // graceful fallback to the always-available system voice
      this._showStatus('Couldn’t load the local voice (needs internet on first run, and a WebGPU browser like Chrome). Using system voice.', false);
      setTimeout(() => this._hideStatus(), 6000);
      this._setEngineButtons('system');
      this._useEngine('system', true).then(() => { if (this.state === 'playing') this.startFrom(i); });
    } else {
      this._showStatus('Speech error: ' + (err && err.message || 'unknown'), false);
      setTimeout(() => this._hideStatus(), 5000);
    }
  }

  _finish() { this._hardStop(); this.state = 'idle'; this._setPlayBtn(); this._clearHighlights(); this.current = 0; this._emit('end'); }

  /* ---------- UI wiring ---------- */
  _wire() {
    const $ = this._$;
    $('play').addEventListener('click', () => this.toggle());
    $('stop').addEventListener('click', () => this.stop());
    $('restart').addEventListener('click', () => this.restart());

    const rate = $('rate');
    rate.addEventListener('input', () => {
      this._rate = parseFloat(rate.value); this._setRateLabel();
      if (this._engineId === 'kokoro' && this.state === 'playing') this.startFrom(this.current);
    });
    $('voiceSel').addEventListener('change', e => {
      this._voiceId = e.target.value;
      if (this._engine.setVoice) this._engine.setVoice(this._voiceId);
      if (this.state === 'playing') this.startFrom(this.current);
    });

    this._wireToggle('setToggle', 'settings');
    this._wireToggle('loadToggle', 'loader');

    this._wireSeg('engineSeg', b => this._switchEngine(b.dataset.engine), false);
    this._wireSeg('sizeSeg', b => this.style.setProperty('--fontsize', b.dataset.size + 'px'));
    this._wireSeg('lhSeg', b => this.style.setProperty('--lh', b.dataset.lh));
    this._wireSeg('themeSeg', b => this.setAttribute('theme', b.dataset.theme));
    this._wireSeg('focusSeg', b => { if (b.dataset.focus === '1') this.setAttribute('focus', ''); else this.removeAttribute('focus'); });

    $('loadBtn').addEventListener('click', () => { const v = $('pasteBox').value.trim(); if (v) { this.load(v); this._closeDrawers(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
    $('loadCancel').addEventListener('click', () => this._closeDrawers());

    // Space toggles play/pause unless typing in a control
    this.shadowRoot.addEventListener('keydown', e => {
      const t = e.composedPath()[0];
      if (t && ['TEXTAREA', 'INPUT', 'SELECT'].includes(t.tagName)) return;
      if (e.code === 'Space' && t && !t.classList.contains('sent')) { e.preventDefault(); this.toggle(); }
    });
  }
  _wireToggle(btnId, drawerId) {
    this._$(btnId).addEventListener('click', () => {
      const d = this._$(drawerId); const open = d.classList.toggle('open');
      this._$(btnId).setAttribute('aria-expanded', String(open));
      const other = drawerId === 'settings' ? 'loader' : 'settings';
      this._$(other).classList.remove('open');
      this._$(other === 'settings' ? 'setToggle' : 'loadToggle').setAttribute('aria-expanded', 'false');
    });
  }
  _wireSeg(id, fn, press = true) {
    const seg = this._$(id);
    seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (press || b.hasAttribute('aria-pressed')) [...seg.children].forEach(c => c.setAttribute('aria-pressed', String(c === b)));
      fn(b);
    });
  }
  _setEngineButtons(id) { const seg = this._$('engineSeg'); if (seg) [...seg.children].forEach(b => b.setAttribute('aria-pressed', String(b.dataset.engine === id))); }
  _setRateLabel() { this._$('rateVal').textContent = this._rate.toFixed(2).replace(/0$/, '') + '×'; }
  _setPlayBtn() {
    const b = this._$('play');
    const label = this.state === 'playing' ? '⏸ Pause' : (this.state === 'paused' ? '▶ Resume' : '▶ Play');
    b.textContent = label; b.setAttribute('aria-label', label.replace(/[^A-Za-z]/g, '') || 'Play');
  }
  _closeDrawers() { ['settings', 'loader'].forEach(d => this._$(d).classList.remove('open')); this._$('setToggle').setAttribute('aria-expanded', 'false'); this._$('loadToggle').setAttribute('aria-expanded', 'false'); }
  _showStatus(msg, busy) { this._$('statusText').textContent = msg; this._$('spin').style.display = busy ? 'block' : 'none'; this._$('status').classList.add('show'); this._emit('status', { message: msg, busy }); }
  _hideStatus() { this._$('status').classList.remove('show'); }
  _emit(name, detail) { this.dispatchEvent(new CustomEvent('rar:' + name, { detail, bubbles: true, composed: true })); }
}

export function defineReadAlongReader(tag = 'read-along-reader') {
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) customElements.define(tag, ReadAlongReader);
  return ReadAlongReader;
}
