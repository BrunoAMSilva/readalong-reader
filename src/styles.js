// readalong-reader — component styles (injected into the shadow root)
// Copyright (C) 2026 Bruno Silva
// Licensed under the GNU GPL v3.0 or later. See LICENSE.
//
// All colors are CSS custom properties on :host so consumers can re-theme
// without touching the shadow DOM. Built-in themes are applied via the
// `theme` attribute (warm | dark | sepia | contrast).

export const CSS = /* css */ `
:host {
  --bg:#1b1d22; --panel:#23262d; --panel-2:#2b2f37; --text:#d7d3c8;
  --muted:#8a8f99; --accent:#e0a458; --accent-2:#5aa9e6;
  --sentence:#33373f; --word:#e0a458; --word-text:#1b1d22; --border:#3a3f48;
  --fontsize:21px; --lh:1.9; --maxw:720px;
  --font:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
  display:block; background:var(--bg); color:var(--text); font-family:var(--font);
  -webkit-font-smoothing:antialiased;
}
:host([theme="dark"]){--bg:#0d0e10;--panel:#16181b;--panel-2:#1e2024;--text:#cfcabb;--sentence:#26282c;--border:#2a2c30;}
:host([theme="sepia"]){--bg:#2b2620;--panel:#352f27;--panel-2:#3f382e;--text:#e6dcc8;--muted:#a99a82;--sentence:#473e31;--border:#4a4234;}
:host([theme="contrast"]){--bg:#000;--panel:#0a0a0a;--panel-2:#141414;--text:#fff;--muted:#bbb;--sentence:#1c3a5e;--word:#ffd84d;--word-text:#000;--accent:#ffd84d;--border:#333;}

*{box-sizing:border-box;}

.bar{position:sticky; top:0; z-index:50; background:var(--panel); border-bottom:1px solid var(--border); padding:12px 16px;}
.bar-inner{max-width:var(--maxw); margin:0 auto; display:flex; flex-wrap:wrap; gap:10px; align-items:center;}
button{font-family:inherit;}
.play-btn{background:var(--accent); color:#1b1d22; border:none; font-size:16px; font-weight:700; padding:11px 22px; border-radius:999px; cursor:pointer; min-width:120px;}
.play-btn:hover{filter:brightness(1.08);}
.play-btn:focus-visible,.icon-btn:focus-visible,.seg button:focus-visible,select:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid var(--accent-2); outline-offset:2px;}
.icon-btn,.toggle{background:var(--panel-2); color:var(--text); border:1px solid var(--border); font-size:15px; padding:10px 14px; border-radius:10px; cursor:pointer;}
.icon-btn:hover,.toggle:hover{border-color:var(--accent);}
.spacer{flex:1;}

.status{max-width:var(--maxw); margin:0 auto; overflow:hidden; max-height:0; transition:max-height .25s;}
.status.show{max-height:80px;}
.status-inner{display:flex; align-items:center; gap:10px; padding:10px 0 2px; color:var(--muted); font-size:13.5px;}
.spin{width:14px;height:14px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:sp .8s linear infinite;flex:none;}
@keyframes sp{to{transform:rotate(360deg);}}

.drawer{max-width:var(--maxw); margin:0 auto; overflow:hidden; max-height:0; transition:max-height .3s ease;}
.drawer.open{max-height:760px;}
.grid{padding:16px 0 4px; display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px;}
.field{display:flex; flex-direction:column; gap:6px;}
.field > label,.mini-label{font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); font-weight:600;}
select{background:var(--panel-2); color:var(--text); border:1px solid var(--border); padding:9px; border-radius:8px; font-size:14px; width:100%;}
input[type=range]{width:100%;}
.seg{display:flex; gap:6px; flex-wrap:wrap;}
.seg button{flex:1; background:var(--panel-2); color:var(--text); border:1px solid var(--border); padding:8px 6px; border-radius:8px; cursor:pointer; font-size:13px; min-width:56px;}
.seg button[aria-pressed="true"]{background:var(--accent); color:#1b1d22; border-color:var(--accent); font-weight:700;}
.val{color:var(--accent); font-weight:700;}

.loader-body{max-height:0; overflow:hidden; transition:max-height .3s;}
.drawer.open .loader-body{max-height:600px; padding-top:14px;}
.row{display:flex; gap:10px; flex-wrap:wrap;}
textarea{width:100%; min-height:160px; background:var(--panel-2); color:var(--text); border:1px solid var(--border); border-radius:10px; padding:12px; font-size:15px; font-family:inherit; line-height:1.6; resize:vertical;}
.hint{color:var(--muted); font-size:13px; margin:8px 0;}
.primary{background:var(--accent); color:#1b1d22; border:none; padding:10px 18px; border-radius:8px; font-weight:700; cursor:pointer;}

.article{max-width:var(--maxw); margin:32px auto; padding:0 24px; font-size:var(--fontsize); line-height:var(--lh);}
.article .eyebrow{color:var(--muted); font-size:.7em; letter-spacing:.08em; text-transform:uppercase; margin-bottom:18px;}
.article h1{font-size:1.5em; line-height:1.3; margin:0 0 6px;}
.article h2{font-size:1.2em; color:var(--accent); margin:1.6em 0 .3em; line-height:1.35;}
.article h3{font-size:1.05em; color:var(--accent); margin:1.4em 0 .3em; line-height:1.4;}
.article h4{font-size:.95em; color:var(--text); margin:1.3em 0 .3em; font-weight:700;}
.article h5,.article h6{font-size:.85em; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; margin:1.2em 0 .3em;}
.article a{color:var(--accent-2); text-decoration:underline; text-underline-offset:2px;}
.article code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.88em; background:var(--panel-2); padding:.08em .35em; border-radius:5px;}
.article pre code{background:none; padding:0;}
.article mark{background:var(--accent); color:var(--word-text); padding:0 .15em; border-radius:3px;}
.article kbd{font-family:ui-monospace,monospace; font-size:.82em; background:var(--panel-2); border:1px solid var(--border); border-radius:5px; padding:.05em .4em;}
.article hr{border:none; border-top:1px solid var(--border); margin:1.8em 0;}
.article .inline-img{max-width:100%; height:auto; vertical-align:middle; border-radius:6px;}
.article p{margin:0 0 1.05em;}
.empty{color:var(--muted); text-align:center; padding:48px 0;}

/* rich content blocks (rendered; visuals are not narrated) */
.article figure{margin:1.4em 0; padding:0;}
.article img{max-width:100%; height:auto; border-radius:10px; display:block;}
.article video{width:100%; border-radius:10px; background:#000;}
.article figcaption{color:var(--muted); font-size:.72em; line-height:1.4; margin-top:8px; text-align:center;}
.article blockquote{margin:1.2em 0; padding:.2em 0 .2em 16px; border-left:3px solid var(--accent); color:var(--text); font-style:italic;}
.article ul, .article ol{margin:0 0 1.05em; padding-left:1.5em;}
.article li{margin:.35em 0;}
.article pre{background:var(--panel-2); border:1px solid var(--border); border-radius:10px; padding:14px; overflow:auto; font-size:.8em; line-height:1.5; margin:1.2em 0;}
.article pre code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace; white-space:pre;}
.article table{border-collapse:collapse; width:100%; font-size:.82em; margin:1.2em 0; display:block; overflow-x:auto;}
.article th, .article td{border:1px solid var(--border); padding:7px 10px; text-align:left;}
.article th{background:var(--panel-2); font-weight:700;}
.article .embed{aspect-ratio:16/9; width:100%; background:var(--panel-2); border:1px solid var(--border); border-radius:10px; display:flex; align-items:center; justify-content:center; overflow:hidden;}
.article .embed iframe{width:100%; height:100%; border:0;}
.embed-play{background:var(--accent); color:#1b1d22; border:none; padding:12px 20px; border-radius:999px; font-weight:700; cursor:pointer; font-family:inherit; font-size:14px;}
.embed-play:hover{filter:brightness(1.08);}

.sent{border-radius:5px; padding:1px 0; transition:background .15s; cursor:pointer;}
.sent:hover{background:rgba(224,164,88,.10);}
.sent.active{background:var(--sentence);}
.word{border-radius:4px; padding:0 1px;}
.word.active{background:var(--word); color:var(--word-text); font-weight:600;}

:host([focus]) .sent{opacity:.32; transition:opacity .25s;}
:host([focus]) .sent.active{opacity:1;}
:host([focus]) .eyebrow{opacity:.32;}

@media (prefers-reduced-motion: reduce){
  *{transition:none !important; scroll-behavior:auto !important;}
  .spin{animation:none;}
}
@media (max-width:600px){
  .article{padding:0 18px; margin-top:20px;}
  .play-btn{min-width:0; flex:1;}
}
`;
