# readalong-reader

An accessible **read-along article reader** as a single web component. It reads
articles aloud in a natural, fully on-device voice and **highlights the current
sentence and word** as it speaks, on a calm dark (or high-contrast) background.

Built for people with **low vision, dyslexia, or ADHD** — and anyone who finds
it easier to follow along when they can both see and hear the text.

> Status: `0.1.0`, early release. The API may change before `1.0`.

## Why

Most "listen to this page" tools use robotic voices, light backgrounds, and give
you no visual anchor for where you are. `readalong-reader` is the opposite:

- **Natural voice, no cloud, no cost.** The optional Kokoro engine generates
  speech locally in the browser. Nothing is sent to an API and there are no
  per-character fees.
- **A place for your eyes.** The current sentence is softly highlighted and the
  current word brightly highlighted, with optional *focus dimming* that fades
  everything else back to cut visual clutter.
- **Comfortable by default.** Dark, sepia, and high-contrast themes; adjustable
  text size, line spacing, and speed; keyboard control throughout.

## Features

- 🎙️ **Two voice engines, swappable at runtime**
  - `system` — the browser's built-in `speechSynthesis`. Zero dependencies and
    **exact** per-word highlighting. Works everywhere, including Safari.
  - `kokoro` — a natural 82M-parameter neural voice running on-device through
    [`kokoro-js`](https://www.npmjs.com/package/kokoro-js) (WebGPU, WASM
    fallback). Optional peer dependency — only loaded if you use it.
- 🔦 Synchronized **sentence + word** highlighting and smooth auto-scroll.
- 🌗 Dark / sepia / high-contrast themes, focus dimming, text-size, line-spacing,
  and speed controls.
- 🔗 Feed it **Markdown**, plain text, or a structured `{title, blocks}` object.
  No fetching, no parsing assumptions — you bring the content however you like,
  and the component makes **zero network calls**.
- ♿ ARIA roles, `aria-current` on the active sentence, full keyboard support,
  and `prefers-reduced-motion` handling.
- 📦 Zero build step required — works straight from a CDN with an import map.

## Install

```bash
npm install readalong-reader
# optional, only for the natural neural voice:
npm install kokoro-js
```

Or use it with **no build step** via a CDN + import map (see the demo below).

## Quick start

### As a web component (recommended)

```html
<read-along-reader id="reader" engine="system" theme="warm" focus></read-along-reader>

<script type="module">
  import 'readalong-reader'; // registers <read-along-reader>

  const reader = document.getElementById('reader');
  reader.loadMarkdown('# Title\n\nParagraph one. It will be read aloud, word by word.');
  // also: reader.loadDoc({ title, blocks }) — or reader.loadText('plain text')
</script>
```

### No build step (CDN)

```html
<script type="importmap">
{ "imports": { "kokoro-js": "https://cdn.jsdelivr.net/npm/kokoro-js/+esm" } }
</script>

<read-along-reader engine="kokoro"></read-along-reader>

<script type="module">
  import 'https://cdn.jsdelivr.net/npm/readalong-reader/src/index.js';
  document.querySelector('read-along-reader')
    .loadMarkdown('# Hello\n\nThis reads aloud, fully on your device.');
</script>
```

Don't want the natural voice? Drop the import map and use `engine="system"` —
`kokoro-js` is never fetched.

### Programmatic / advanced use

```js
import 'readalong-reader';                       // registers the element
import { parseMarkdown } from 'readalong-reader/parse';

const el = document.querySelector('read-along-reader');
el.loadDoc(parseMarkdown('# Title\n\nBody text.'));
el.engine = 'kokoro';
el.play();
```

## API

### Attributes

| Attribute        | Values                                  | Description |
|------------------|-----------------------------------------|-------------|
| `engine`         | `system` \| `kokoro`                    | Active voice engine. |
| `theme`          | `warm` \| `dark` \| `sepia` \| `contrast` | Color theme. |
| `focus`          | boolean (present/absent)                | Focus dimming on/off. |
| `rate`           | number (0.6–1.6)                        | Speech speed. |
| `markdown`       | string                                  | Initial Markdown to read. |
| `text`           | string                                  | Initial plain text to read. |
| `kokoro-module`  | URL or specifier                        | Where to import `kokoro-js` from (e.g. a CDN URL). |

### Methods

`loadMarkdown(md)`, `loadDoc(doc)`, `loadText(text)`, `load(input)` (auto-detects
doc / Markdown / text), `play()`, `pause()`, `toggle()`, `stop()`, `restart()`,
`startFrom(index)`. There's also a `markdown` property (get/set).

### Events

All bubble and cross the shadow boundary: `rar:load`, `rar:play`, `rar:pause`,
`rar:stop`, `rar:end`, `rar:sentence` (`{index, text}`), `rar:enginechange`,
`rar:status`.

### Theming

Override any CSS custom property on the host:

```css
read-along-reader { --accent:#7cc6ff; --word:#7cc6ff; --maxw:680px; --fontsize:22px; }
```

## Bring your own content

The reader never fetches anything — you decide where text comes from:

```js
import { parseMarkdown } from 'readalong-reader/parse';

// 1) From your own Markdown
reader.loadMarkdown(myMarkdownString);

// 2) From a CMS / structured data — skip parsing entirely
reader.loadDoc({ title: 'My Post', blocks: [{ h2: 'Intro' }, { p: 'Hello.' }] });

// 3) Fetch + clean an article yourself, on your terms (e.g. a readability proxy)
const md = await (await fetch('https://r.jina.ai/' + articleUrl)).text();
reader.loadDoc(parseMarkdown(md));
```

The structured doc is just `{ eyebrow?, title?, blocks: [{ h2 } | { p }] }`.

## Writing your own TTS engine

Implement the small `TTSEngine` interface (see `src/engines/base.js`) and pass an
instance in. An engine drives word highlighting via `onWord(index)` and signals
completion via `onEnd()`; the reader owns sentence sequencing. This is how the
estimated-timing Kokoro engine and the exact-timing system engine share one code
path.

## A note on the Kokoro voice

- First run downloads the model once (~300 MB at `fp32`, then cached and offline).
- On WebGPU the engine uses `fp32` deliberately: the `q8` quantized model sounds
  garbled ("Simlish") on that backend. WASM uses the smaller `q8`.
- Kokoro returns finished audio per sentence with no word-boundary events, so
  **word** highlighting is estimated from the audio clock (sentence highlighting
  is always exact). For exact word timing, use `engine="system"`.

## Privacy

The reader makes **no network calls**. Speech is generated on your device, and
content is whatever you pass in. (The optional Kokoro engine downloads its model
once from a CDN / Hugging Face on first use, then runs offline.) If you choose to
fetch articles, that happens in *your* code — see "Bring your own content".

## Browser support

- `system` engine: any browser with the Web Speech API (incl. Safari).
- `kokoro` engine: a WebGPU browser (Chrome/Edge, recent) for best speed; falls
  back to WASM, and to the system engine if the model can't load.

## Roadmap

These are planned next steps — contributions welcome:

- **Richer article rendering** — keep inline images, figures, and embedded video
  from the source (currently text + headings only).

## Contributing

Issues and PRs welcome — accessibility feedback especially. Please keep the core
dependency-free and the component usable without a build step.

## License

[GPL-3.0-or-later](./LICENSE) © Bruno Silva.

Built with care for the low-vision community. If it helps you, that's the point.
