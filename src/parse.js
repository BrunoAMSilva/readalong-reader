// readalong-reader — text parsing & article fetching
// Copyright (C) 2026 Bruno Silva
// Licensed under the GNU GPL v3.0 or later. See LICENSE.

/**
 * A normalized document the reader can render.
 * @typedef {Object} ReaderDoc
 * @property {string|null} eyebrow
 * @property {string|null} title
 * @property {Array<{h2?:string, p?:string}>} blocks
 */

/**
 * Split a paragraph into sentences, keeping trailing punctuation and quotes.
 * @param {string} text
 * @returns {string[]}
 */
export function splitSentences(text) {
  text = (text || '').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const parts = text.match(/[^.!?]+(?:[.!?]+["”’')\]]*|$)/g);
  return parts ? parts.map(s => s.trim()).filter(Boolean) : [text];
}

/** Strip inline Markdown to plain text. */
export function stripInline(s) {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')      // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')    // links -> visible text
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1')       // code
    .replace(/\*\*([^*]+)\*\*/g, '$1')           // bold
    .replace(/\*([^*]+)\*/g, '$1')               // italic
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')        // underline/italic
    .replace(/^\s*[-*+]\s+/, '')                  // bullet marker
    .replace(/^>\s?/, '')                          // blockquote marker
    .trim();
}

/**
 * Parse Markdown (including the "Title:/Markdown Content:" preamble produced by
 * readability services such as r.jina.ai) into a ReaderDoc.
 * @param {string} md
 * @returns {ReaderDoc}
 */
export function parseMarkdown(md) {
  md = md || '';
  let title = null;
  const tm = md.match(/^Title:\s*(.+)$/m);
  if (tm) title = tm[1].trim();
  const cut = md.indexOf('Markdown Content:');
  if (cut >= 0) md = md.slice(cut + 'Markdown Content:'.length);

  const blocks = [];
  md.split('\n').forEach(line => {
    const t = line.trim();
    if (!t) return;
    if (/^[-*_=]{3,}$/.test(t)) return;            // horizontal rule
    if (/^#{1,6}\s/.test(t)) {
      const text = stripInline(t.replace(/^#{1,6}\s+/, ''));
      if (!text) return;
      if (!title) { title = text; return; }
      if (text.toLowerCase() === title.toLowerCase()) return; // de-dupe title
      blocks.push({ h2: text });
      return;
    }
    if (/^!\[/.test(t)) return;                     // standalone image
    const text = stripInline(t);
    if (text.length > 1) blocks.push({ p: text });
  });
  return { eyebrow: null, title: title || 'Article', blocks };
}

/**
 * Heuristically parse pasted plain text into a ReaderDoc. Short, unpunctuated
 * lines are treated as headings; the first short line becomes the title.
 * @param {string} raw
 * @returns {ReaderDoc}
 */
export function parsePasted(raw) {
  const lines = (raw || '').split(/\n+/).map(l => l.trim()).filter(Boolean);
  let title = null;
  const blocks = [];
  lines.forEach((line, i) => {
    const wc = line.split(/\s+/).length;
    const clean = /[.!?:”]$/.test(line);
    if (i === 0 && wc <= 20) { title = line; return; }
    if (wc <= 10 && !clean && line.length < 80) blocks.push({ h2: line });
    else blocks.push({ p: line });
  });
  return { eyebrow: null, title: title || 'Pasted article', blocks };
}
