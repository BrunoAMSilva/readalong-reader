// readalong-reader — <read-along-reader> custom element + ReadAlongReader class
// Copyright (C) 2026 Bruno Silva
// Licensed under the GNU GPL v3.0 or later. See LICENSE.

import { CSS } from './styles.js';
import { splitSentences, parseMarkdown, parsePasted } from './parse.js';
import { SystemEngine } from './engines/system-engine.js';
import { KokoroEngine } from './engines/kokoro-engine.js';

// Sanitization allowlists. Anything not listed is unwrapped to plain text, so
// HTML from Markdown or extracted articles can never inject scripts/handlers.
// How many upcoming sentences to generate ahead of playback (buffer depth).
const PREFETCH_AHEAD = 3;
const ALLOWED_INLINE = new Set(['A', 'STRONG', 'EM', 'B', 'I', 'CODE', 'S', 'DEL', 'INS', 'MARK', 'SUP', 'SUB', 'SMALL', 'ABBR', 'SPAN', 'U', 'Q', 'CITE', 'TIME', 'BDI', 'BDO', 'WBR', 'KBD', 'SAMP', 'VAR']);
const ALLOWED_BLOCK = new Set(['P', 'DIV', 'SPAN', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'FIGURE', 'FIGCAPTION', 'HR', 'IMG', 'BR', ...ALLOWED_INLINE]);

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
    // Only react to a runtime engine change. Before the element is connected,
    // attributes may still be arriving (e.g. `kokoro-module` set after `engine`);
    // connectedCallback performs the initial engine setup once all are present.
    if (name === 'engine' && val && val !== this._engineId && this.isConnected) { this.engine = val; }
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
  // Turn a pre-built span (already containing .word spans) into a registered,
  // clickable sentence.
  _commitSentence(el, words) {
    const idx = this.sentences.length;
    el.classList.add('sent'); el.dataset.s = idx; el.setAttribute('role', 'button'); el.tabIndex = 0;
    this.sentences.push({ el, words, text: (el.textContent || '').replace(/\s+/g, ' ').trim() });
    el.addEventListener('click', () => this.startFrom(idx));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.startFrom(idx); } });
  }
  _registerSentence(el, text) { const words = this._fillWords(el, text); this._commitSentence(el, words); }

  // --- safe inline rendering: preserves formatting while wrapping words ---
  _parseInline(html) { const t = document.createElement('template'); t.innerHTML = String(html == null ? '' : html); return Array.from(t.content.childNodes); }

  _cloneInline(el) {
    const tag = el.tagName;
    if (tag === 'IMG') {
      const src = el.getAttribute('src') || '';
      if (!/^(https?:|data:image\/)/i.test(src)) return null;
      const img = document.createElement('img'); img.src = src; img.alt = el.getAttribute('alt') || ''; img.loading = 'lazy'; img.className = 'inline-img'; return img;
    }
    const out = document.createElement(tag.toLowerCase());
    if (tag === 'A') {
      const href = el.getAttribute('href') || '';
      if (/^(https?:|mailto:|#)/i.test(href)) { out.setAttribute('href', href); if (!href.startsWith('#')) { out.target = '_blank'; out.rel = 'noopener noreferrer'; } }
    } else if (tag === 'ABBR' || tag === 'TIME' || tag === 'BDO') {
      const t = el.getAttribute('title') || el.getAttribute('datetime'); if (t) out.setAttribute('title', t);
    }
    return out;
  }

  // Render an inline value (string or {html}) into `container` as one or more
  // clickable sentence spans. Inline formatting (bold/italic/links/code…) is
  // preserved; anything not on the allowlist is unwrapped to plain text.
  _renderSpoken(container, value, single = false) {
    const v = (value && typeof value === 'object') ? value : { text: String(value == null ? '' : value) };
    if (v.html == null) {
      // plain-text fast path
      const make = (txt) => { const span = document.createElement('span'); const words = this._fillWords(span, txt); this._commitSentence(span, words); return span; };
      if (single) { container.appendChild(make(v.text)); }
      else splitSentences(v.text).forEach(sen => { const s = make(sen); s.appendChild(document.createTextNode(' ')); container.appendChild(s); });
      return;
    }
    this._renderInlineNodes(container, this._parseInline(v.html), single);
  }

  _renderInlineNodes(container, nodes, single) {
    let sent = null;
    const open = () => { sent = { el: document.createElement('span'), words: [] }; container.appendChild(sent.el); };
    const finish = () => { if (sent && sent.words.length) this._commitSentence(sent.el, sent.words); sent = null; };
    const addWord = (sink, text) => { const w = document.createElement('span'); w.className = 'word'; w.textContent = text; sink.appendChild(w); sent.words.push(w); };
    const ENDS = /[.!?]["'”’)\]]*$/;

    // append words inside an inline element (never break sentences here)
    const noBreak = (childNodes, sink) => {
      for (const n of childNodes) {
        if (n.nodeType === 3) {
          for (const p of n.textContent.split(/(\s+)/)) {
            if (p === '') continue;
            if (/^\s+$/.test(p)) sink.appendChild(document.createTextNode(p)); else addWord(sink, p);
          }
        } else if (n.nodeType === 1) {
          if (n.tagName === 'BR') { sink.appendChild(document.createElement('br')); }
          else if (n.tagName === 'IMG') { const im = this._cloneInline(n); if (im) sink.appendChild(im); }
          else if (ALLOWED_INLINE.has(n.tagName)) { const cl = this._cloneInline(n); if (cl) { sink.appendChild(cl); noBreak(n.childNodes, cl); } else noBreak(n.childNodes, sink); }
          else noBreak(n.childNodes, sink);
        }
      }
    };

    for (const n of nodes) {
      if (n.nodeType === 3) {
        for (const p of n.textContent.split(/(\s+)/)) {
          if (p === '') continue;
          if (/^\s+$/.test(p)) { if (sent) sent.el.appendChild(document.createTextNode(p)); continue; }
          if (!sent) open();
          addWord(sent.el, p);
          if (!single && ENDS.test(p)) finish();
        }
      } else if (n.nodeType === 1) {
        if (n.tagName === 'BR') { if (!sent) open(); sent.el.appendChild(document.createElement('br')); continue; }
        if (n.tagName === 'IMG') { if (!sent) open(); const im = this._cloneInline(n); if (im) sent.el.appendChild(im); continue; }
        if (!sent) open();
        if (ALLOWED_INLINE.has(n.tagName)) { const cl = this._cloneInline(n); if (cl) { sent.el.appendChild(cl); noBreak(n.childNodes, cl); } else noBreak(n.childNodes, sent.el); }
        else noBreak(n.childNodes, sent.el);
      }
    }
    finish();
  }

  // Block-level sanitize for raw HTML blocks (rendered, not narrated).
  _sanitizeBlock(nodes) {
    const clean = (n) => {
      if (n.nodeType === 3) return document.createTextNode(n.textContent);
      if (n.nodeType !== 1) return null;
      if (n.tagName === 'IMG') return this._cloneInline(n);
      if (!ALLOWED_BLOCK.has(n.tagName)) { const f = document.createDocumentFragment(); for (const c of n.childNodes) { const cc = clean(c); if (cc) f.appendChild(cc); } return f; }
      const el = (n.tagName === 'A') ? (this._cloneInline(n) || document.createElement('span')) : document.createElement(n.tagName.toLowerCase());
      for (const c of n.childNodes) { const cc = clean(c); if (cc) el.appendChild(cc); }
      return el;
    };
    const out = document.createDocumentFragment();
    for (const n of nodes) { const c = clean(n); if (c) out.appendChild(c); }
    return out;
  }

  _figure(mediaEl, caption) {
    const fig = document.createElement('figure');
    fig.appendChild(mediaEl);
    if (caption) { const c = document.createElement('figcaption'); c.textContent = caption; fig.appendChild(c); }
    return fig;
  }

  // Render one block. Text blocks (heading, p, quote, list items) are spoken;
  // visual blocks (img, video, embed, code, table, hr, rawHtml) are rendered silently.
  _renderBlock(art, block) {
    if (block == null) return;
    if (block.heading) {
      const lvl = Math.min(6, Math.max(1, block.heading.level || 2));
      const h = document.createElement('h' + lvl);
      this._renderSpoken(h, block.heading.html != null ? { html: block.heading.html } : (block.heading.text || ''), true);
      art.appendChild(h); return;
    }
    if (block.h2 != null) { const h = document.createElement('h2'); this._renderSpoken(h, block.h2, true); art.appendChild(h); return; }
    if (block.p != null) { const p = document.createElement('p'); this._renderSpoken(p, block.p, false); art.appendChild(p); return; }
    if (block.quote != null) { const bq = document.createElement('blockquote'); this._renderSpoken(bq, block.quote, false); art.appendChild(bq); return; }
    if (block.list && Array.isArray(block.list.items)) {
      const l = document.createElement(block.list.ordered ? 'ol' : 'ul');
      block.list.items.forEach(it => { const li = document.createElement('li'); this._renderSpoken(li, it, true); l.appendChild(li); });
      art.appendChild(l); return;
    }
    if (block.hr) { art.appendChild(document.createElement('hr')); return; }
    if (block.img && /^(https?:|data:image\/)/i.test(block.img.src || '')) {
      const img = document.createElement('img');
      img.src = block.img.src; img.alt = block.img.alt || ''; img.loading = 'lazy'; img.decoding = 'async';
      art.appendChild(this._figure(img, block.img.caption)); return;
    }
    if (block.video && /^https?:/i.test(block.video.src || '')) {
      const v = document.createElement('video');
      v.src = block.video.src; v.controls = true; v.preload = 'metadata';
      if (block.video.poster) v.poster = block.video.poster;
      art.appendChild(this._figure(v, block.video.caption)); return;
    }
    if (block.embed && /^https?:/i.test(block.embed.url || '')) {
      const holder = document.createElement('div'); holder.className = 'embed';
      const btn = document.createElement('button'); btn.className = 'embed-play'; btn.type = 'button';
      btn.textContent = '▶ Load embedded media' + (block.embed.provider ? ` (${block.embed.provider})` : '');
      btn.addEventListener('click', () => {
        const f = document.createElement('iframe');
        f.src = block.embed.url; f.loading = 'lazy'; f.allowFullscreen = true; f.title = block.embed.title || 'Embedded media';
        f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups');
        holder.replaceChildren(f);
      });
      holder.appendChild(btn);
      art.appendChild(this._figure(holder, block.embed.caption)); return;
    }
    if (block.code != null) {
      const pre = document.createElement('pre'); const code = document.createElement('code');
      if (block.lang) code.className = 'language-' + String(block.lang).replace(/[^\w-]/g, '');
      code.textContent = block.code; pre.appendChild(code); art.appendChild(pre); return;
    }
    if (block.table && Array.isArray(block.table.rows)) {
      const table = document.createElement('table');
      block.table.rows.forEach((row, ri) => {
        const tr = document.createElement('tr');
        (row || []).forEach(cell => { const c = document.createElement(ri === 0 ? 'th' : 'td'); c.textContent = String(cell); tr.appendChild(c); });
        table.appendChild(tr);
      });
      art.appendChild(table); return;
    }
    if (block.rawHtml != null) { const wrap = document.createElement('div'); wrap.className = 'rawhtml'; wrap.appendChild(this._sanitizeBlock(this._parseInline(block.rawHtml))); art.appendChild(wrap); return; }
  }

  _render(doc) {
    this._hardStop(); this.state = 'idle'; this._setPlayBtn();
    const art = this._$('article');
    art.innerHTML = ''; this.sentences = [];
    if (doc.eyebrow) { const e = document.createElement('div'); e.className = 'eyebrow'; e.textContent = doc.eyebrow; art.appendChild(e); }
    if (doc.title) { const h = document.createElement('h1'); this._renderSpoken(h, doc.title, true); art.appendChild(h); }
    (doc.blocks || []).forEach(block => this._renderBlock(art, block));
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
    if (id === 'kokoro') {
      const mod = this.getAttribute('kokoro-module') || undefined;
      // Recreate if the cached engine was built with a different module spec
      // (guards against an engine created before `kokoro-module` was set).
      const cached = this._engines.kokoro;
      if (cached && cached._module === (mod || 'kokoro-js')) return cached;
      if (cached && cached.dispose) cached.dispose();
      const eng = new KokoroEngine({ module: mod });
      this._engines.kokoro = eng;
      return eng;
    }
    if (this._engines[id]) return this._engines[id];
    const eng = new SystemEngine();
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
    // Queue the CURRENT sentence first (so it generates ahead of the buffer)…
    this._engine.speak(utt, {
      voice: this._voiceId,
      rate: this._rate,
      onWord: idx => { if (tk !== this._token) return; if (idx < 0) this._clearWords(s); else this._highlightWord(s, idx); },
      onEnd: () => { if (tk !== this._token || this.state !== 'playing') return; this._clearWords(s); this.current++; this._speak(this.current); },
      onError: err => { if (tk !== this._token) return; this._onEngineError(err, i); },
      cancelled: () => tk !== this._token,
    });
    // …then buffer the next few so the next clip is ready when this one ends.
    if (this._engine.prefetch) {
      for (let k = 1; k <= PREFETCH_AHEAD; k++) {
        const n = this.sentences[i + k];
        if (n) this._engine.prefetch({ text: n.text, words: [] });
      }
    }
  }

  _onEngineError(err, i) {
    const detail = (err && (err.message || String(err))) || 'unknown error';
    if (typeof console !== 'undefined') console.error('[readalong-reader] natural voice failed:', err);
    this._emit('voiceerror', { engine: this._engineId, message: detail });
    if (this._engineId === 'kokoro') {
      // graceful fallback to the always-available system voice — but surface why
      this._showStatus('Natural voice unavailable — using system voice. (' + detail + ')', false);
      setTimeout(() => this._hideStatus(), 9000);
      this._setEngineButtons('system');
      this._useEngine('system', true).then(() => { if (this.state === 'playing') this.startFrom(i); });
    } else {
      this._showStatus('Speech error: ' + detail, false);
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
