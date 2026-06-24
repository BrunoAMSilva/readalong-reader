// readalong-reader — text parsing
// Copyright (C) 2026 Bruno Silva
// Licensed under the GNU GPL v3.0 or later. See LICENSE.
import { marked } from 'marked';

/**
 * A normalized document the reader can render. Text blocks accept either a plain
 * string or an object { html } carrying sanitized inline markup.
 * @typedef {Object} ReaderDoc
 * @property {string|null} eyebrow
 * @property {string|null} title
 * @property {Array<Object>} blocks  Each block is one of:
 *   {p}, {heading:{level,...}}, {h2} (legacy), {quote}, {code,lang?}, {hr},
 *   {list:{ordered?,items}}, {rawHtml},
 *   {img:{src,alt?,caption?}}, {video:{src,poster?,caption?}},
 *   {embed:{url,provider?,title?,caption?}}, {table:{rows:string[][]}}.
 *   Text values (p/heading/quote/list items) may be a string or { html }.
 */

/**
 * Split a paragraph into sentences, keeping trailing punctuation and quotes.
 * @param {string} text
 * @returns {string[]}
 */
export function splitSentences(text) {
  // Be defensive: callers should pass a string, but tolerate {html}/{text}
  // objects or other types rather than throwing.
  if (text && typeof text === 'object') {
    text = text.html != null ? String(text.html).replace(/<[^>]*>/g, ' ')
         : text.text != null ? text.text : '';
  }
  text = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
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

/** Strip HTML tags to plain text (for titles / de-dupe comparisons). */
function stripTags(html) {
  return String(html || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

/**
 * Parse Markdown into a ReaderDoc using a full CommonMark + GFM parser (marked).
 * Inline formatting (bold, italic, links, code, strikethrough…) is preserved as
 * sanitized inline HTML on text blocks; heading levels are kept. Also handles
 * the "Title:/Markdown Content:" preamble produced by readability services.
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

  const tokens = marked.lexer(md, { gfm: true });
  const blocks = [];

  const inline = (text) => marked.parseInline(text || '', { gfm: true });
  const inlineOfBlocks = (toks) =>
    (toks || []).map(x => (x.type === 'paragraph' ? inline(x.text) : x.text ? inline(x.text) : '')).filter(Boolean).join('<br><br>');

  const handle = (toks) => {
    for (const t of toks) {
      switch (t.type) {
        case 'heading': {
          const html = inline(t.text);
          const plain = stripTags(html);
          if (!plain) break;
          if (!title) { title = plain; break; }
          if (plain.toLowerCase() === title.toLowerCase()) break; // de-dupe title
          blocks.push({ heading: { level: t.depth || 2, html } });
          break;
        }
        case 'paragraph': {
          // a paragraph that is only an image → image block
          if (t.tokens && t.tokens.length === 1 && t.tokens[0].type === 'image') {
            const im = t.tokens[0];
            blocks.push({ img: { src: im.href, alt: im.text || '', caption: im.title || '' } });
          } else {
            blocks.push({ p: { html: inline(t.text) } });
          }
          break;
        }
        case 'blockquote': blocks.push({ quote: { html: inlineOfBlocks(t.tokens) } }); break;
        case 'list': {
          const items = (t.items || []).map(it => ({ html: inline(it.text) }));
          blocks.push({ list: { ordered: !!t.ordered, items } });
          break;
        }
        case 'code': blocks.push({ code: t.text, lang: t.lang || '' }); break;
        case 'table': {
          const rows = [
            (t.header || []).map(c => c.text),
            ...(t.rows || []).map(r => r.map(c => c.text)),
          ];
          blocks.push({ table: { rows } });
          break;
        }
        case 'hr': blocks.push({ hr: true }); break;
        case 'html': { const h = (t.text || '').trim(); if (h) blocks.push({ rawHtml: h }); break; }
        case 'space': break;
        default: if (t.tokens) handle(t.tokens); else if (t.text) blocks.push({ p: { html: inline(t.text) } });
      }
    }
  };
  handle(tokens);
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
