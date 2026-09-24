'use strict';


const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const MAX_BYTES = 100 * 1024 * 1024;
const PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const CHARS_PER_SEC = 14.5;

/* ---------------- helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmtTime = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
const fmtDur = s => { const m = Math.round(s / 60); if (m < 60) return `${Math.max(1, m)} min`; const h = Math.floor(m / 60); return `${h} h ${m % 60} min`; };
const fmtBytes = b => b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
const fmtRate = r => `${+r.toFixed(2)}×`;
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i); return (h >>> 0).toString(36); };
class AppError extends Error { constructor(code) { super(code); this.code = code; } }

/* ---------------- Icons ---------------- */
const SV = (inner, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${inner}</svg>`;
const Icons = {
  logo: SV('<path d="M6 2.8h8.4l4.8 4.8v13.6H6z"/><path d="M14.2 2.8v5h5"/><path d="M9.6 12.6v4.2M12.4 10.6v8.2M15.2 13.2v3"/>'),
  pdf: SV('<path d="M6 2.8h8.4l4.8 4.8v13.6H6z"/><path d="M14.2 2.8v5h5"/><path d="M9 13.5h6M9 16.5h4"/>'),
  upload: SV('<path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9"/><path d="M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15"/>'),
  search: SV('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>'),
  settings: SV('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  list: SV('<path d="M4 6.5h16M4 12h16M4 17.5h10"/>'),
  headphones: SV('<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4.5" height="6" rx="1.5"/><rect x="16" y="14" width="4.5" height="6" rx="1.5"/>'),
  x: SV('<path d="M6 6l12 12M18 6 6 18"/>'),
  up: SV('<path d="m6 15 6-6 6 6"/>'),
  down: SV('<path d="m6 9 6 6 6-6"/>'),
  chevD: SV('<path d="m6 9 6 6 6-6"/>'),
  chevL: SV('<path d="m15 6-6 6 6 6"/>'),
  chevR: SV('<path d="m9 6 6 6-6 6"/>'),
  target: SV('<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/>'),
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 5.3v13.4c0 .7.8 1.1 1.4.7l10.1-6.7a.8.8 0 0 0 0-1.4L9.6 4.6c-.6-.4-1.4 0-1.4.7z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.6" y="5" width="3.8" height="14" rx="1.1" fill="currentColor"/><rect x="13.6" y="5" width="3.8" height="14" rx="1.1" fill="currentColor"/></svg>',
  back: SV('<path d="M4.6 12a7.4 7.4 0 1 0 2.2-5.3"/><path d="M4.4 3.6v3.6H8"/><text x="12.1" y="15.1" text-anchor="middle" font-size="7" font-weight="600" font-family="Instrument Sans, system-ui, sans-serif" fill="currentColor" stroke="none">15</text>'),
  fwd: SV('<path d="M19.4 12a7.4 7.4 0 1 1-2.2-5.3"/><path d="M19.6 3.6v3.6H16"/><text x="11.9" y="15.1" text-anchor="middle" font-size="7" font-weight="600" font-family="Instrument Sans, system-ui, sans-serif" fill="currentColor" stroke="none">15</text>'),
  voice: SV('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
  vol: SV('<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  mute: SV('<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>'),
  expand: SV('<path d="M14.5 4.5H19.5V9.5M9.5 19.5H4.5V14.5M19.5 4.5 13.5 10.5M4.5 19.5l6-6"/>'),
  alert: SV('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.8v5"/><circle cx="12" cy="16" r=".6" fill="currentColor"/>'),
  check: SV('<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/>'),
  info: SV('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".6" fill="currentColor"/>'),
  fText: SV('<path d="M6 2.8h8.4l4.8 4.8v13.6H6z"/><path d="M9 11h7M9 14h7M9 17h4"/>'),
  fVoice: SV('<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10.5v3"/>'),
  fSpeed: SV('<path d="M4.5 16a7.5 7.5 0 1 1 15 0"/><path d="m12 16 3.6-4.6"/><circle cx="12" cy="16" r="1" fill="currentColor"/>'),
  fHl: SV('<path d="M4 19.5h16"/><rect x="4" y="6" width="16" height="7" rx="2"/><path d="M7.5 9.5h9"/>'),
  fMark: SV('<path d="M7 3.5h10v17l-5-3.6-5 3.6z"/>'),
};
function hydrateIcons(root = document) { $$('[data-icon]', root).forEach(el => { if (!el.dataset.done) { el.innerHTML = Icons[el.dataset.icon] || ''; el.dataset.done = 1; } }); }

/* ---------------- Store (per-viewer preferences and positions) ---------------- */
const Store = {
  get(k, d) { try { const v = localStorage.getItem('listenpdf:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('listenpdf:' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const prefs = Object.assign({ theme: 'dark', size: 19, follow: true, headings: true, rate: 1, voiceURI: null, volume: 1 }, Store.get('prefs', {}));
const savePrefs = () => Store.set('prefs', prefs);

/* ---------------- Toast ---------------- */
const Toast = {
  show(title, msg = '', { type = 'info', action = null, timeout = 6500 } = {}) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `<div class="t-icon">${Icons[type === 'error' ? 'alert' : type === 'ok' ? 'check' : 'info']}</div>
      <div><div class="t-title">${esc(title)}</div>${msg ? `<div class="t-msg">${esc(msg)}</div>` : ''}${action ? `<button class="t-act" type="button">${esc(action.label)}</button>` : ''}</div>
      <button class="t-x" aria-label="Dismiss" type="button">${Icons.x}</button>`;
    const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 200); };
    el.querySelector('.t-x').onclick = close;
    if (action) el.querySelector('.t-act').onclick = () => { action.fn(); close(); };
    const box = $('#toasts'); box.appendChild(el);
    while (box.children.length > 3) box.firstElementChild.remove();
    if (timeout) setTimeout(close, timeout);
    return close;
  },
};

/* =====================================================================
   PDFProcessor — PDF parsing only (pdf.js)
   ===================================================================== */
const PDFProcessor = {
  async whenReady(ms = 15000) {
    const t0 = Date.now();
    while (!window.pdfjsLib) { if (Date.now() - t0 > ms) throw new AppError('engine'); await sleep(100); }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  },
  async open(buffer) {
    await this.whenReady();
    // The worker script is loaded on the page, so pdf.js runs its parser on the main thread.
    return window.pdfjsLib.getDocument({ data: buffer, isEvalSupported: false, useSystemFonts: true }).promise;
  },
  async extract(pdf, onProgress) {
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      pages.push({ num: n, height: vp.height, lines: this.toLines(tc.items) });
      page.cleanup();
      onProgress && onProgress(n, pdf.numPages);
      if (n % 6 === 0) await sleep(0);
    }
    return pages;
  },
  // Group positioned text runs into visual lines.
  toLines(items) {
    const lines = []; let cur = null;
    const push = () => { if (cur) { lines.push(cur); cur = null; } };
    for (const it of items) {
      if (!('str' in it)) continue;
      const t = it.transform, size = Math.hypot(t[2], t[3]) || it.height || 10, x = t[4], y = t[5];
      if (cur && Math.abs(y - cur.y) > Math.max(cur.size, size) * 0.45) push();
      if (it.str.length) {
        if (!cur) cur = { text: '', size, x, y, right: x, chars: 0, sizeSum: 0 };
        else if (cur.text && !/\s$/.test(cur.text) && !/^\s/.test(it.str) && x - cur.right > size * 0.18) cur.text += ' ';
        cur.text += it.str; cur.right = Math.max(cur.right, x + (it.width || 0));
        const n = it.str.trim().length; cur.chars += n; cur.sizeSum += size * n;
      }
      if (it.hasEOL) push();
    }
    push();
    return lines.map(l => ({ text: l.text.replace(/\s+/g, ' ').trim(), size: l.chars ? l.sizeSum / l.chars : l.size, x: l.x, y: l.y, w: l.right - l.x })).filter(l => l.text);
  },
  async thumbnail(pdf) {
    const page = await pdf.getPage(1);
    const vp1 = page.getViewport({ scale: 1 });
    const scale = 200 / vp1.width;
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return c.toDataURL('image/jpeg', 0.82);
  },
};

/* =====================================================================
   OCRProcessor — optional fallback for scanned PDFs (tesseract.js, lazy)
   ===================================================================== */
const OCRProcessor = {
  loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new AppError('ocr')); document.head.appendChild(s); });
  },
  async run(pdf, onProgress) {
    if (!window.Tesseract) await this.loadScript(TESSERACT_URL);
    if (!window.Tesseract) throw new AppError('ocr');
    const worker = await Promise.race([window.Tesseract.createWorker('eng'), sleep(45000).then(() => { throw new AppError('ocr'); })]).catch(() => { throw new AppError('ocr'); });
    const pages = []; const max = Math.min(pdf.numPages, 150);
    try {
      for (let n = 1; n <= max; n++) {
        const page = await pdf.getPage(n);
        const vp = page.getViewport({ scale: 1.8 });
        const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
        await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        const { data } = await worker.recognize(c);
        const paras = (data.text || '').split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
        pages.push({ num: n, height: 1e6, lines: paras.map((t, k) => ({ text: t, size: 10, x: 0, y: 5e5 - k * 40, w: 500 })) });
        onProgress && onProgress(n, max);
      }
    } finally { worker.terminate(); }
    return pages;
  },
};

/* =====================================================================
   TextProcessor — lines → headings, paragraphs, sentence segments
   ===================================================================== */
const TextProcessor = {
  endsSentence: t => /[.!?:;"”’)\]…]$/.test(t),
  build(pages) {
    // 1. dominant body font size
    const hist = new Map();
    pages.forEach(p => p.lines.forEach(l => { const k = Math.round(l.size * 2) / 2; hist.set(k, (hist.get(k) || 0) + l.text.length); }));
    let body = 10, best = -1; hist.forEach((v, k) => { if (v > best) { best = v; body = k; } });

    // 2. running headers / footers and page numbers
    const isEdge = (l, p) => l.y > p.height * 0.91 || l.y < p.height * 0.085;
    const norm = t => t.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
    const counts = new Map();
    pages.forEach(p => { const seen = new Set(); p.lines.forEach(l => { if (isEdge(l, p)) seen.add(norm(l.text)); }); seen.forEach(k => counts.set(k, (counts.get(k) || 0) + 1)); });
    const repeated = new Set(); counts.forEach((c, k) => { if (c >= 3 && c >= pages.length * 0.35) repeated.add(k); });
    const pageNum = /^(page\s*)?(\d+|[ivxlc]+)(\s*(of|\/)\s*\d+)?$/i;

    // 3. blocks
    const blocks = []; let para = null;
    const flush = () => { if (para) { blocks.push(para); para = null; } };
    for (const p of pages) {
      const widths = p.lines.filter(l => Math.abs(l.size - body) < 1).map(l => l.w).sort((a, b) => a - b);
      const typical = widths.length ? widths[Math.floor(widths.length * 0.8)] : 400;
      let prev = null;
      p.lines.forEach((l, idx) => {
        if (isEdge(l, p) && (pageNum.test(l.text) || repeated.has(norm(l.text)))) return;
        const ratio = l.size / body;
        const words = l.text.split(/\s+/).length;
        if (ratio >= 1.18 && l.text.length <= 160 && words <= 22 && /\p{L}/u.test(l.text)) {
          const last = blocks[blocks.length - 1];
          if (!para && last && last.type === 'h' && last.page === p.num && last.lineIdx === idx - 1 && Math.abs(last.size - l.size) < 0.6 && last.text.length < 200) {
            last.text += ' ' + l.text; last.lineIdx = idx; return;
          }
          flush();
          blocks.push({ type: 'h', level: ratio >= 1.6 ? 1 : ratio >= 1.32 ? 2 : 3, text: l.text, page: p.num, size: l.size, lineIdx: idx });
          prev = null; return;
        }
        if (para) {
          let brk = false;
          if (para.lastPage !== p.num || !prev) brk = this.endsSentence(para.text);
          else {
            const dy = prev.y - l.y, lh = Math.max(prev.size, l.size);
            if (dy > lh * 1.85) brk = true;
            else if (dy < -lh && this.endsSentence(para.text)) brk = true;
            else if (prev.w < typical * 0.7 && this.endsSentence(prev.text)) brk = true;
            else if (Math.abs(l.size - para.size) / body > 0.12) brk = true;
          }
          if (brk) flush();
        }
        if (!para) para = { type: 'p', text: l.text, page: p.num, lastPage: p.num, size: l.size, breaks: [{ offset: 0, page: p.num }] };
        else {
          if (para.lastPage !== p.num) para.breaks.push({ offset: para.text.length + 1, page: p.num });
          if (/\p{L}-$/u.test(para.text) && /^\p{Ll}/u.test(l.text)) para.text = para.text.slice(0, -1) + l.text;
          else para.text += ' ' + l.text;
          para.lastPage = p.num;
        }
        prev = l;
      });
    }
    flush();

    // 4. normalize heading levels to 1..3
    const lv = [...new Set(blocks.filter(b => b.type === 'h').map(b => b.level))].sort();
    blocks.forEach(b => { if (b.type === 'h') b.level = lv.indexOf(b.level) + 1; });

    // 5. segments
    const segments = [], headings = [], out = [];
    for (const b of blocks) {
      const segStart = segments.length;
      if (b.type === 'h') {
        segments.push({ text: b.text, page: b.page, heading: true });
        headings.push({ text: b.text, level: b.level, page: b.page, seg: segStart });
      } else {
        for (const s of this.splitSentences(b.text)) {
          let page = b.page; for (const br of b.breaks) if (br.offset <= s.start) page = br.page;
          segments.push({ text: s.text, page });
        }
      }
      if (segments.length > segStart) out.push({ type: b.type, level: b.level, page: b.page, segStart, segEnd: segments.length });
    }
    segments.forEach(s => { s.est = Math.max(0.5, s.text.length / CHARS_PER_SEC) + (s.heading ? 0.6 : 0.25); });
    return { blocks: out, segments, headings };
  },
  splitSentences(text) {
    const parts = [];
    if (window.Intl && Intl.Segmenter) {
      for (const s of new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(text)) parts.push({ text: s.segment, start: s.index });
    } else {
      const re = /[^.!?…]+(?:[.!?…]+["'”’)\]]*)?\s*/g; let m;
      while ((m = re.exec(text))) { if (!m[0]) { re.lastIndex++; continue; } parts.push({ text: m[0], start: m.index }); }
    }
    const out = [];
    for (const p of parts) {
      const t = p.text.trim(); if (!t) continue;
      const st = p.start + (p.text.length - p.text.trimStart().length);
      if (t.length < 4 && out.length) { out[out.length - 1].text += ' ' + t; continue; }
      if (t.length > 260) this.chunk(t).forEach(c => out.push({ text: c.text, start: st + c.start }));
      else out.push({ text: t, start: st });
    }
    return out;
  },
  // Break very long sentences at clause boundaries so speech engines don't stall.
  chunk(t, max = 230) {
    const res = []; let start = 0;
    while (t.length - start > max) {
      const win = t.slice(start, start + max);
      let cut = Math.max(win.lastIndexOf(', '), win.lastIndexOf('; '), win.lastIndexOf(': '), win.lastIndexOf(' – '), win.lastIndexOf(' — '));
      if (cut < max * 0.4) cut = win.lastIndexOf(' ');
      cut = cut <= 0 ? max : cut + 1;
      res.push({ text: t.slice(start, start + cut).trim(), start });
      start += cut; while (t[start] === ' ') start++;
    }
    res.push({ text: t.slice(start).trim(), start });
    return res.filter(c => c.text);
  },
};

/* =====================================================================
   TTS providers — modular. Add another by extending TTSProvider.
   ===================================================================== */
class TTSProvider {
  constructor() { this.id = 'base'; this.label = 'Base'; }
  isSupported() { return false; }
  async init() { return []; }
  getVoices() { return []; }
  onVoicesChanged() { }
  speak() { }          // (text, {voice, rate, volume, onStart, onBoundary, onEnd, onError})
  cancel() { }
  isSpeaking() { return false; }
  prepare() { }        // audio-file providers prefetch the next chunk here
}

class WebSpeechProvider extends TTSProvider {
  constructor() { super(); this.id = 'webspeech'; this.label = 'Browser voices'; this.voices = []; this.listeners = []; this.current = null; }
  get synth() { return window.speechSynthesis; }
  isSupported() { return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window; }
  init() {
    if (!this.isSupported()) return Promise.resolve([]);
    return new Promise(res => {
      let done = false;
      const load = () => {
        const v = this.synth.getVoices();
        if (v.length) { this.voices = v; this.listeners.forEach(f => f(v)); if (!done) { done = true; res(v); } }
      };
      load();
      if (this.synth.addEventListener) this.synth.addEventListener('voiceschanged', load); else this.synth.onvoiceschanged = load;
      setTimeout(() => { if (!done) { done = true; this.voices = this.synth.getVoices(); res(this.voices); } }, 2500);
    });
  }
  getVoices() { return this.voices; }
  onVoicesChanged(fn) { this.listeners.push(fn); }
  speak(text, o) {
    const u = new SpeechSynthesisUtterance(text);
    if (o.voice) { u.voice = o.voice; u.lang = o.voice.lang; }
    u.rate = o.rate; u.volume = o.volume; u.pitch = 1;
    u.onstart = () => o.onStart && o.onStart();
    u.onboundary = e => { if ((e.name === 'word' || !e.name) && o.onBoundary) o.onBoundary(e.charIndex); };
    u.onend = () => o.onEnd && o.onEnd();
    u.onerror = e => o.onError && o.onError(e.error || 'unknown');
    this.current = u; // keep a reference: some engines drop callbacks for collected utterances
    this.synth.speak(u);
    if (this.synth.paused) this.synth.resume();
  }
  cancel() { if (this.isSupported()) this.synth.cancel(); }
  isSpeaking() { return this.isSupported() && (this.synth.speaking || this.synth.pending); }
}

/* =====================================================================
   Narrator — playback engine. Voice and rate are independent:
   setRate() only changes the rate and re-speaks from the current word,
   it never touches this.voice.
   ===================================================================== */
class Narrator {
  constructor(provider) {
    this.p = provider; this.segs = []; this.cum = []; this.total = 0;
    this.index = 0; this.offset = 0; this.playing = false; this.ended = false;
    this.rate = 1; this.voice = null; this.volume = 1; this.skipHeadings = false;
    this.gen = 0; this.startOffset = 0; this.lastBoundary = 0; this.segStartAt = 0; this.errors = 0; this.h = {};
  }
  on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); }
  emit(ev, ...a) { (this.h[ev] || []).forEach(f => f(...a)); }
  load(segs) {
    this.stop(); this.segs = segs; let t = 0;
    this.cum = segs.map(s => { const c = t; t += s.est; return c; });
    this.total = t; this.index = 0; this.offset = 0; this.ended = false;
  }
  get segment() { return this.segs[this.index]; }
  baseTime() {
    const s = this.segment; if (!s) return 0;
    const len = Math.max(1, s.text.length);
    let within = s.est * (this.offset / len);
    if (this.playing && this.segStartAt) {
      const el = (performance.now() - this.segStartAt) / 1000 * this.rate;
      within = s.est * this.startOffset / len + Math.min(el, s.est * (1 - this.startOffset / len) * 0.97);
    }
    if (this.ended) return this.total;
    return this.cum[this.index] + within;
  }
  currentTime() { return this.baseTime() / this.rate; }
  totalTime() { return this.total / this.rate; }

  play() {
    if (!this.segs.length || !this.p.isSupported() || this.playing) return;
    if (this.ended) { this.index = 0; this.offset = 0; this.ended = false; }
    this.playing = true; this.emit('state', true);
    this.speakCurrent(true);
  }
  pause() {
    if (!this.playing) return;
    this.offset = this.resumePoint(); this.playing = false; this.gen++; this.segStartAt = 0;
    this.p.cancel(); this.emit('state', false); this.emit('position');
  }
  toggle() { this.playing ? this.pause() : this.play(); }
  stop() { this.gen++; const was = this.playing; this.playing = false; this.segStartAt = 0; this.p.cancel(); if (was) this.emit('state', false); }
  resumePoint() {
    const s = this.segment; if (!s) return 0;
    let i = clamp(this.lastBoundary, 0, s.text.length);
    while (i > 0 && /\S/.test(s.text[i - 1])) i--;
    return i >= s.text.length - 2 ? 0 : i;
  }
  speakCurrent(immediate = false) {
    const gen = ++this.gen;
    while (this.skipHeadings && this.segment && this.segment.heading && this.index < this.segs.length - 1) { this.index++; this.offset = 0; }
    const s = this.segment; if (!s) return this.finish();
    const start = this.offset, text = s.text.slice(start);
    this.startOffset = start; this.lastBoundary = start; this.segStartAt = 0;
    this.emit('segment', this.index);
    const go = () => {
      if (gen !== this.gen) return;
      this.segStartAt = performance.now();
      this.p.speak(text, {
        voice: this.voice, rate: this.rate, volume: this.volume,
        onStart: () => { if (gen === this.gen) this.segStartAt = performance.now(); },
        onBoundary: ci => { if (gen === this.gen) this.lastBoundary = start + ci; },
        onEnd: () => { if (gen === this.gen) { this.errors = 0; this.advance(); } },
        onError: err => { if (gen === this.gen && err !== 'interrupted' && err !== 'canceled') this.fail(err); },
      });
      const next = this.segs[this.index + 1];
      if (next) this.p.prepare(next.text, { voice: this.voice });
    };
    const busy = this.p.isSpeaking();
    this.p.cancel();
    if (immediate && !busy) go(); else setTimeout(go, 45);
  }
  advance() {
    this.offset = 0;
    if (this.index < this.segs.length - 1) { this.index++; this.speakCurrent(); } else this.finish();
  }
  finish() { this.gen++; this.playing = false; this.ended = true; this.segStartAt = 0; this.emit('state', false); this.emit('end'); }
  fail(err) {
    this.errors++;
    if (err === 'not-allowed') { this.stop(); this.emit('error', 'blocked'); return; }
    if (err === 'network') { this.offset = this.resumePoint(); this.stop(); this.emit('error', 'network'); return; }
    if (this.errors >= 3) { this.stop(); this.emit('error', 'failed'); return; }
    if (this.errors === 1) this.speakCurrent(); else this.advance();
  }
  watchdog() {
    // Some engines occasionally never fire "end". Move on if we're far past the estimate.
    if (!this.playing || !this.segStartAt) return;
    const s = this.segment; if (!s) return;
    const expected = s.est * (1 - this.startOffset / Math.max(1, s.text.length)) / this.rate;
    if ((performance.now() - this.segStartAt) / 1000 > expected * 2.6 + 6 && !this.p.isSpeaking()) this.advance();
  }
  seek(i, offset = 0) {
    this.index = clamp(i, 0, this.segs.length - 1); this.offset = offset; this.ended = false;
    if (this.playing) this.speakCurrent(); else this.emit('segment', this.index);
    this.emit('position');
  }
  seekTime(base) {
    base = clamp(base, 0, Math.max(0, this.total - 0.01));
    let lo = 0, hi = this.cum.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (this.cum[m] <= base) lo = m; else hi = m - 1; }
    const s = this.segs[lo]; let off = Math.floor((base - this.cum[lo]) / s.est * s.text.length);
    off = clamp(off, 0, s.text.length - 1); while (off > 0 && /\S/.test(s.text[off - 1])) off--;
    if (off > s.text.length - 12) off = 0;
    this.seek(lo, off);
  }
  skip(sec) { this.seekTime(this.baseTime() + sec * this.rate); }
  setRate(r) {
    r = clamp(r, 0.25, 2); if (r === this.rate) return;
    if (this.playing) { this.offset = this.resumePoint(); this.rate = r; this.speakCurrent(); }
    else this.rate = r;
    this.emit('rate', r);
  }
  setVoice(v) { this.voice = v; if (this.playing) { this.offset = this.resumePoint(); this.speakCurrent(); } }
  setVolume(v) { this.volume = v; if (this.playing) { this.offset = this.resumePoint(); this.speakCurrent(); } }
  preview(text) {
    if (this.playing) this.pause();
    this.gen++; this.p.cancel();
    setTimeout(() => this.p.speak(text, { voice: this.voice, rate: this.rate, volume: this.volume }), 60);
  }
}

/* =====================================================================
   App state
   ===================================================================== */
const provider = new WebSpeechProvider();
const narrator = new Narrator(provider);
narrator.rate = clamp(+prefs.rate || 1, 0.25, 2);
narrator.volume = clamp(+prefs.volume, 0, 1);
narrator.skipHeadings = !prefs.headings;

let doc = null;            // { key, name, title, size, numPages, blocks, segments, headings, thumb }
let segEls = [];
let activeEl = null, activeBlock = null;
let userScrollAt = 0;
let voiceList = [];
const els = {
  landing: $('#landing'), reader: $('#reader'), docEl: $('#doc'), scroller: $('#scroller'),
  fileInput: $('#fileInput'), toc: $('#toc'), pageInput: $('#pageInput'),
};

/* ---------------- theme & settings ---------------- */
function applyTheme() {
  document.documentElement.dataset.theme = prefs.theme;
  $$('[data-theme-set]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeSet === prefs.theme)));
}
function applySize() { document.documentElement.style.setProperty('--read-size', prefs.size + 'px'); $('#sizeVal').textContent = prefs.size; }
applyTheme(); applySize();

/* =====================================================================
   PDFUploader
   ===================================================================== */
const Proc = {
  open(name, size) {
    $('#procName').textContent = name; $('#procSize').textContent = size;
    $('#procMain').hidden = false; $('#procScan').hidden = true; this.set(0, 'Uploading'); $('#proc').hidden = false;
  },
  set(p, text) { $('#procFill').style.width = (p * 100).toFixed(1) + '%'; $('#procPct').textContent = Math.round(p * 100) + '%'; if (text) $('#procText').textContent = text; },
  close() { $('#proc').hidden = true; },
  askScanned() {
    return new Promise(res => {
      $('#procMain').hidden = true; $('#procScan').hidden = false; $('#scanOcr').focus();
      $('#scanOcr').onclick = () => { $('#procScan').hidden = true; $('#procMain').hidden = false; res(true); };
      $('#scanCancel').onclick = () => { res(false); els.fileInput.click(); };
    });
  },
};

function readFile(file, onProgress) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    r.onload = () => res(r.result);
    r.onerror = () => rej(new AppError('read'));
    r.readAsArrayBuffer(file);
  });
}

let busy = false;
async function handleFile(file) {
  if (!file || busy) return;
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) return Toast.show("That file isn't a PDF", `"${file.name}" can't be opened. Choose a file that ends in .pdf.`, { type: 'error' });
  if (file.size === 0) return Toast.show('This PDF is empty', 'The file has no content. Export or download it again, then upload it.', { type: 'error' });
  if (file.size > MAX_BYTES) return Toast.show('This PDF is too large', `ListenPDF opens files up to 100 MB. This one is ${fmtBytes(file.size)}. Try splitting it into parts.`, { type: 'error' });

  busy = true; let pdf = null;
  Proc.open(file.name, fmtBytes(file.size));
  try {
    const buf = await readFile(file, p => Proc.set(p * 0.12, 'Uploading'));
    const head = new TextDecoder('latin1').decode(new Uint8Array(buf, 0, Math.min(1024, buf.byteLength)));
    if (!head.includes('%PDF')) throw new AppError('corrupt');
    Proc.set(0.14, 'Opening document');
    pdf = await PDFProcessor.open(buf);
    if (!pdf.numPages) throw new AppError('nopages');
    let pages = await PDFProcessor.extract(pdf, (n, t) => Proc.set(0.16 + 0.74 * n / t, `Extracting text, page ${n} of ${t}`));
    const chars = pages.reduce((a, p) => a + p.lines.reduce((b, l) => b + l.text.length, 0), 0);
    if (chars < Math.max(40, pdf.numPages * 12)) {
      const ok = await Proc.askScanned();
      if (!ok) throw new AppError('cancelled');
      Proc.set(0.02, 'Loading text recognition');
      pages = await OCRProcessor.run(pdf, (n, t) => Proc.set(0.05 + 0.85 * n / t, `Recognizing text, page ${n} of ${t}`));
    }
    Proc.set(0.93, 'Finding headings and sentences');
    await sleep(20);
    const built = TextProcessor.build(pages);
    if (!built.segments.length) throw new AppError('notext');
    Proc.set(0.97, 'Preparing the reader');
    const thumb = await PDFProcessor.thumbnail(pdf).catch(() => null);
    Proc.set(1, 'Ready');
    await sleep(180);
    openDocument({
      key: hash(`${file.name}|${file.size}|${pdf.numPages}`), name: file.name,
      title: file.name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim() || 'Untitled document',
      size: file.size, numPages: pdf.numPages, thumb, ...built,
    });
    Proc.close();
  } catch (e) {
    Proc.close();
    showError(e);
  } finally {
    busy = false;
    if (pdf) try { pdf.destroy(); } catch { /* ignore */ }
    els.fileInput.value = '';
  }
}

function showError(e) {
  const code = e && (e.code || e.name);
  const offline = !navigator.onLine;
  const map = {
    cancelled: null,
    PasswordException: ['This PDF is password-protected', 'Remove the password in your PDF app, then upload it again.'],
    InvalidPDFException: ['This PDF couldn\'t be opened', 'The file looks damaged or incomplete. Download or export it again, then upload it.'],
    corrupt: ['This PDF couldn\'t be opened', 'The file looks damaged or isn\'t really a PDF. Download or export it again, then upload it.'],
    nopages: ['This PDF has no pages', 'There\'s nothing to read in this file. Choose a different PDF.'],
    notext: ['No readable text found', 'The PDF opened, but it doesn\'t contain text that can be read aloud.'],
    read: ['The file couldn\'t be read', 'Your browser couldn\'t access this file. Move it to a local folder and try again.'],
    engine: ['The PDF reader didn\'t load', offline ? 'You appear to be offline. Reconnect, then reload the page.' : 'Reload the page and try again.'],
    ocr: ['Text recognition couldn\'t start', 'The OCR engine couldn\'t be downloaded here. Try a PDF with selectable text, or export the scan with OCR from your scanner app.'],
  };
  if (code in map) { if (map[code]) Toast.show(map[code][0], map[code][1], { type: 'error', timeout: 9000 }); return; }
  console.error(e);
  Toast.show('Something went wrong while reading this PDF', offline ? 'You appear to be offline. Reconnect and try again.' : 'Try again, or choose a different file.', { type: 'error' });
}

/* dropzone + global drop */
const dz = $('#dropzone');
dz.addEventListener('click', () => els.fileInput.click());
dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.fileInput.click(); } });
['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, () => dz.classList.remove('drag')));
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) handleFile(f); });
els.fileInput.addEventListener('change', () => handleFile(els.fileInput.files[0]));
document.addEventListener('click', e => {
  const a = e.target.closest('[data-action]'); if (!a) return;
  if (a.dataset.action === 'upload') els.fileInput.click();
  if (a.dataset.action === 'home') { e.preventDefault(); goHome(); }
});
$('#homeBrand').addEventListener('click', e => e.preventDefault());

/* =====================================================================
   Views
   ===================================================================== */
function showView(name) {
  const toReader = name === 'reader';
  els.landing.hidden = toReader; els.reader.hidden = !toReader;
  const v = toReader ? els.reader : els.landing;
  v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  document.body.classList.toggle('landing-on', !toReader);
  if (!toReader) { renderRecents(); startSpecimen(); } else stopSpecimen();
}
function goHome() { narrator.pause(); closeDrawers(); showView('landing'); }

/* =====================================================================
   DocumentViewer
   ===================================================================== */
function openDocument(d) {
  narrator.stop(); Search.close(); closeDrawers();
  doc = d;
  narrator.load(d.segments);
  renderDocument(d);
  renderToc(d);
  const thumbHTML = d.thumb ? `<img src="${d.thumb}" alt="">` : Icons.pdf;
  $('#thumb').innerHTML = thumbHTML; $('#mThumb').innerHTML = thumbHTML;
  $('#fileName').textContent = d.name; $('#mTitle').textContent = d.title; $('#fullDoc').textContent = d.title;
  $('#pageTotal').textContent = d.numPages; els.pageInput.max = d.numPages; els.pageInput.value = 1;
  updateMeta();
  showView('reader');
  els.scroller.scrollTop = 0;

  const saved = Store.get('pos:' + d.key, null);
  if (saved && saved.i > 0 && saved.i < d.segments.length) {
    narrator.seek(saved.i);
    requestAnimationFrame(() => followActive(true, true));
    Toast.show('Picked up where you left off', `Page ${d.segments[saved.i].page}. Press play to continue.`, {
      type: 'ok', action: { label: 'Start from the beginning', fn: () => { narrator.seek(0); els.scroller.scrollTo({ top: 0, behavior: 'smooth' }); } },
    });
  } else { narrator.seek(0); }
  updateProgress(); savePosition(true);
  if (!provider.isSupported()) Toast.show('Speech isn\'t available in this browser', 'You can still read and search. For listening, open ListenPDF in Chrome, Edge, or Safari.', { type: 'error', timeout: 10000 });
}

function renderDocument(d) {
  const html = [`<header class="doc-head"><h1>${esc(d.title)}</h1><p id="docMeta"></p></header>`];
  let nextPage = 1;
  const marks = upTo => { while (nextPage <= upTo) { html.push(`<div class="page-mark" id="pg-${nextPage}" data-page="${nextPage}">Page ${nextPage}</div>`); nextPage++; } };
  d.blocks.forEach((b, bi) => {
    marks(b.page);
    if (b.type === 'h') {
      const tag = 'h' + (b.level + 1);
      html.push(`<${tag} class="hd lvl${b.level}" data-block="${bi}" data-level="${b.level}"><button class="fold" type="button" data-block="${bi}" aria-expanded="true" aria-label="Collapse section">${Icons.chevD}</button><span class="s" data-i="${b.segStart}">${esc(d.segments[b.segStart].text)}</span></${tag}>`);
    } else {
      const parts = [];
      for (let i = b.segStart; i < b.segEnd; i++) parts.push(`<span class="s" data-i="${i}">${esc(d.segments[i].text)}</span>`);
      html.push(`<p class="para" data-block="${bi}">${parts.join(' ')}</p>`);
    }
  });
  marks(d.numPages);
  els.docEl.classList.toggle('big', d.segments.length > 2500);
  els.docEl.innerHTML = html.join('');
  segEls = new Array(d.segments.length);
  $$('.s', els.docEl).forEach(el => { segEls[+el.dataset.i] = el; });
  activeEl = null; activeBlock = null;
  cacheMarks();
}

function updateMeta() {
  if (!doc) return;
  const dur = fmtDur(narrator.totalTime());
  $('#fileSub').textContent = `${doc.numPages} ${doc.numPages === 1 ? 'page' : 'pages'}, about ${dur} at ${fmtRate(narrator.rate)}`;
  const m = $('#docMeta');
  if (m) m.textContent = `${doc.numPages} ${doc.numPages === 1 ? 'page' : 'pages'}. About ${dur} of listening at ${fmtRate(narrator.rate)}. Click any sentence to start reading from there.`;
}

/* collapse / expand sections */
function toggleSection(bi, force) {
  const h = els.docEl.querySelector(`.hd[data-block="${bi}"]`); if (!h) return;
  const level = +h.dataset.level;
  const collapse = force !== undefined ? force : !h.classList.contains('collapsed');
  h.classList.toggle('collapsed', collapse);
  const btn = h.querySelector('.fold'); btn.setAttribute('aria-expanded', String(!collapse)); btn.setAttribute('aria-label', collapse ? 'Expand section' : 'Collapse section');
  let el = h.nextElementSibling, skipLevel = 0, hidden = 0;
  while (el) {
    const isHd = el.classList.contains('hd');
    if (isHd && +el.dataset.level <= level) break;
    if (collapse) { el.classList.add('folded'); if (el.classList.contains('para')) hidden++; }
    else {
      if (isHd && skipLevel && +el.dataset.level <= skipLevel) skipLevel = 0;
      if (!skipLevel) { el.classList.remove('folded'); if (isHd && el.classList.contains('collapsed')) skipLevel = +el.dataset.level; }
    }
    el = el.nextElementSibling;
  }
  h.dataset.hidden = collapse ? `${hidden} ${hidden === 1 ? 'paragraph' : 'paragraphs'} hidden` : '';
  cacheMarks();
}
function ensureVisible(el) {
  let guard = 0;
  while (el && el.closest('.folded') && guard++ < 50) {
    let p = el.closest('.folded') || el;
    let h = p.previousElementSibling;
    while (h && !(h.classList.contains('hd') && h.classList.contains('collapsed'))) h = h.previousElementSibling;
    if (!h) break;
    toggleSection(+h.dataset.block, false);
  }
}

/* page tracking */
let pageMarks = [];
function cacheMarks() { pageMarks = $$('.page-mark', els.docEl).filter(m => !m.classList.contains('folded')); }
let scrollRaf = 0;
function onScroll() {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0; if (!doc) return;
    const top = els.scroller.getBoundingClientRect().top + 90;
    let lo = 0, hi = pageMarks.length - 1, cur = 0;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (pageMarks[m].getBoundingClientRect().top <= top) { cur = m; lo = m + 1; } else hi = m - 1; }
    const page = pageMarks[cur] ? +pageMarks[cur].dataset.page : 1;
    if (document.activeElement !== els.pageInput) els.pageInput.value = page;
    updateReturnPill();
  });
}
els.scroller.addEventListener('scroll', onScroll, { passive: true });
['wheel', 'touchmove'].forEach(ev => els.scroller.addEventListener(ev, () => { userScrollAt = Date.now(); }, { passive: true }));
els.scroller.addEventListener('keydown', e => { if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(e.key)) userScrollAt = Date.now(); });

function jumpToPage(n) {
  if (!doc) return;
  n = clamp(Math.round(n) || 1, 1, doc.numPages);
  els.pageInput.value = n;
  const mark = $('#pg-' + n); ensureVisible(mark);
  const i = doc.segments.findIndex(s => s.page >= n);
  if (i >= 0) narrator.seek(i);
  if (mark) { userScrollAt = Date.now(); els.scroller.scrollTo({ top: mark.offsetTop - 16, behavior: reduceMotion() ? 'auto' : 'smooth' }); }
}
els.pageInput.addEventListener('change', () => jumpToPage(+els.pageInput.value));
els.pageInput.addEventListener('keydown', e => { if (e.key === 'Enter') { jumpToPage(+els.pageInput.value); els.pageInput.blur(); } });

/* sentence click → read from here */
els.docEl.addEventListener('click', e => {
  const fold = e.target.closest('.fold');
  if (fold) { toggleSection(+fold.dataset.block); return; }
  const sel = window.getSelection(); if (sel && !sel.isCollapsed) return;
  const s = e.target.closest('.s'); if (!s) return;
  userScrollAt = 0;
  narrator.seek(+s.dataset.i);
});

/* =====================================================================
   TextHighlighter + follow-along scrolling
   ===================================================================== */
function setActive(i) {
  if (activeEl) activeEl.classList.remove('active', 'cursor');
  if (activeBlock) activeBlock.classList.remove('reading');
  activeEl = segEls[i] || null;
  if (!activeEl) return;
  activeEl.classList.add(narrator.playing ? 'active' : 'cursor');
  activeBlock = activeEl.closest('.para, .hd');
  if (activeBlock) activeBlock.classList.add('reading');
}
function followActive(force = false, instant = false) {
  if (!activeEl) return;
  ensureVisible(activeEl);
  const sc = els.scroller, r = activeEl.getBoundingClientRect(), sr = sc.getBoundingClientRect();
  const top = r.top - sr.top, h = sr.height;
  if (!force && top > h * 0.14 && r.bottom - sr.top < h * 0.72) return;
  const target = sc.scrollTop + top - h * 0.3;
  sc.scrollTo({ top: target, behavior: instant || reduceMotion() ? 'auto' : 'smooth' });
}
function activeInView() {
  if (!activeEl) return true;
  const r = activeEl.getBoundingClientRect(), sr = els.scroller.getBoundingClientRect();
  return r.bottom > sr.top + 10 && r.top < sr.bottom - 10;
}
function updateReturnPill() { $('#returnPill').hidden = !(doc && narrator.playing && !activeInView()); }
$('#returnPill').addEventListener('click', () => { userScrollAt = 0; followActive(true); $('#returnPill').hidden = true; });

/* =====================================================================
   TableOfContents
   ===================================================================== */
function renderToc(d) {
  const toc = els.toc;
  if (d.headings.length) {
    $('#tocTitle').textContent = 'Contents';
    $('#tocCount').textContent = d.headings.length > 1 ? `${d.headings.length} sections` : '';
    toc.innerHTML = d.headings.slice(0, 600).map((h, k) => `<button type="button" class="l${h.level}" data-h="${k}"><span>${esc(h.text)}</span><span class="pg">${h.page}</span></button>`).join('');
  } else {
    $('#tocTitle').textContent = 'Pages';
    $('#tocCount').textContent = 'No headings detected';
    const n = Math.min(d.numPages, 1000); const b = [];
    for (let p = 1; p <= n; p++) b.push(`<button type="button" data-page="${p}"><span>Page ${p}</span><span class="pg"></span></button>`);
    toc.innerHTML = b.join('');
  }
}
els.toc.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !doc) return;
  if (b.dataset.h !== undefined) { const h = doc.headings[+b.dataset.h]; userScrollAt = 0; narrator.seek(h.seg); followActive(true); }
  else jumpToPage(+b.dataset.page);
  if (window.innerWidth <= 1180) closeDrawers();
});
function headingIndexAt(i) {
  const H = doc ? doc.headings : []; let lo = 0, hi = H.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (H[m].seg <= i) { r = m; lo = m + 1; } else hi = m - 1; }
  return r;
}
let tocActive = null;
function updateSectionUI(i) {
  if (!doc) return;
  const hi = headingIndexAt(i);
  const seg = doc.segments[i];
  const label = hi >= 0 ? doc.headings[hi].text : `Page ${seg ? seg.page : 1}`;
  $('#nowSec').textContent = label; $('#mSec').textContent = label; $('#fullSec').textContent = label;
  let btn = null;
  if (doc.headings.length) btn = els.toc.querySelector(`[data-h="${hi}"]`);
  else if (seg) btn = els.toc.querySelector(`[data-page="${seg.page}"]`);
  if (btn !== tocActive) {
    if (tocActive) tocActive.removeAttribute('aria-current');
    tocActive = btn;
    if (btn) { btn.setAttribute('aria-current', 'true'); const tr = els.toc.getBoundingClientRect(), br = btn.getBoundingClientRect(); if (br.top < tr.top || br.bottom > tr.bottom) btn.scrollIntoView({ block: 'nearest' }); }
  }
}
function jumpSection(dir) {
  if (!doc) return;
  const i = narrator.index;
  if (!doc.headings.length) { const p = doc.segments[i].page + dir; if (p >= 1 && p <= doc.numPages) jumpToPage(p); return; }
  const hi = headingIndexAt(i);
  let target;
  if (dir > 0) target = doc.headings[hi + 1];
  else target = hi >= 0 && i > doc.headings[hi].seg + 1 ? doc.headings[hi] : doc.headings[Math.max(0, hi - 1)];
  if (target) { userScrollAt = 0; narrator.seek(target.seg); followActive(true); }
}

/* =====================================================================
   SearchDocument
   ===================================================================== */
const Search = {
  touched: [], marks: [], cur: -1, timer: 0,
  open() { if (!doc) return; $('#searchbar').hidden = false; const i = $('#searchInput'); i.focus(); i.select(); if (window.innerWidth <= 1180) closeDrawers(); },
  close() { this.clear(); $('#searchbar').hidden = true; $('#searchInput').value = ''; $('#searchCount').textContent = ''; },
  clear() { this.touched.forEach(i => { if (segEls[i]) segEls[i].textContent = doc.segments[i].text; }); this.touched = []; this.marks = []; this.cur = -1; },
  run(q) {
    this.clear(); q = q.trim();
    if (q.length < 2) { $('#searchCount').textContent = ''; return; }
    const ql = q.toLowerCase(); let total = 0;
    for (let i = 0; i < doc.segments.length && total < 1500; i++) {
      const t = doc.segments[i].text, tl = t.toLowerCase();
      let pos = tl.indexOf(ql); if (pos < 0) continue;
      let html = '', last = 0;
      while (pos >= 0 && total < 1500) { html += esc(t.slice(last, pos)) + `<mark class="find">${esc(t.slice(pos, pos + q.length))}</mark>`; last = pos + q.length; total++; pos = tl.indexOf(ql, last); }
      segEls[i].innerHTML = html + esc(t.slice(last)); this.touched.push(i);
    }
    this.marks = $$('mark.find', els.docEl);
    if (!this.marks.length) { $('#searchCount').textContent = 'No matches'; return; }
    // start at the first match after the current reading position
    let start = this.marks.findIndex(m => +m.closest('.s').dataset.i >= narrator.index);
    this.go(start < 0 ? 0 : start);
  },
  go(k) {
    if (!this.marks.length) return;
    if (this.marks[this.cur]) this.marks[this.cur].classList.remove('cur');
    this.cur = (k + this.marks.length) % this.marks.length;
    const m = this.marks[this.cur]; m.classList.add('cur'); ensureVisible(m);
    $('#searchCount').textContent = `${this.cur + 1} of ${this.marks.length}${this.marks.length >= 1500 ? '+' : ''}`;
    userScrollAt = Date.now();
    const sc = els.scroller, r = m.getBoundingClientRect(), sr = sc.getBoundingClientRect();
    sc.scrollTo({ top: sc.scrollTop + r.top - sr.top - sr.height * 0.35, behavior: reduceMotion() ? 'auto' : 'smooth' });
  },
};
$('#searchInput').addEventListener('input', e => { clearTimeout(Search.timer); Search.timer = setTimeout(() => Search.run(e.target.value), 180); });
$('#searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); Search.go(Search.cur + (e.shiftKey ? -1 : 1)); } if (e.key === 'Escape') Search.close(); });
$('#searchNext').onclick = () => Search.go(Search.cur + 1);
$('#searchPrev').onclick = () => Search.go(Search.cur - 1);
$('#searchClose').onclick = () => Search.close();
$('#searchBtn').onclick = () => $('#searchbar').hidden ? Search.open() : Search.close();
$('#leftSearch').onclick = () => Search.open();

/* =====================================================================
   SpeedController
   ===================================================================== */
function buildChips() {
  $$('[data-chips]').forEach(box => { box.innerHTML = PRESETS.map(p => `<button type="button" class="chip" data-rate="${p}" aria-pressed="false">${fmtRate(p)}</button>`).join(''); });
}
buildChips();
document.addEventListener('click', e => { const c = e.target.closest('.chip[data-rate]'); if (c) applyRate(+c.dataset.rate); });
function applyRate(r) {
  r = Math.round(clamp(r, 0.25, 2) * 100) / 100;
  narrator.setRate(r);          // only the rate changes; voice is untouched
  prefs.rate = r; savePrefs(); updateRateUI(true);
}
function updateRateUI(animate) {
  const r = narrator.rate;
  const v = $('#speedVal'); v.textContent = fmtRate(r);
  if (animate) { v.classList.remove('tick'); void v.offsetWidth; v.classList.add('tick'); }
  $$('.chip[data-rate]').forEach(c => c.setAttribute('aria-pressed', String(Math.abs(+c.dataset.rate - r) < 0.001)));
  const sr = $('#speedRange'); sr.value = r; syncRange(sr);
  $$('[data-speed-label]').forEach(el => { el.textContent = fmtRate(r); });
  updateMeta(); updateProgress();
}
function stepRate(dir) {
  const r = narrator.rate;
  const next = dir > 0 ? PRESETS.find(p => p > r + 0.001) : [...PRESETS].reverse().find(p => p < r - 0.001);
  if (next !== undefined) applyRate(next);
}
function cycleRate() { const r = narrator.rate; const n = PRESETS.find(p => p > r + 0.001); applyRate(n === undefined ? PRESETS[0] : n); }
$('#speedRange').addEventListener('input', e => { syncRange(e.target); $('#speedVal').textContent = fmtRate(+e.target.value); });
$('#speedRange').addEventListener('change', e => applyRate(+e.target.value));

/* =====================================================================
   VoiceSelector
   ===================================================================== */
let langNames = null; try { langNames = new Intl.DisplayNames([navigator.language || 'en'], { type: 'language' }); } catch { /* unsupported */ }
const langLabel = l => { const tag = (l || '').replace('_', '-'); try { return (langNames && tag && langNames.of(tag)) || tag || 'Other'; } catch { return tag || 'Other'; } };
const shortName = v => v.name.split(' - ')[0].replace(/^Microsoft\s+/, '').replace(/\s+Online \(Natural\)/, ' (Natural)');
const userBase = (navigator.language || 'en').split('-')[0].toLowerCase();

function populateVoices(voices) {
  voiceList = voices.slice();
  const sel = $('#voiceSelect');
  if (!provider.isSupported()) {
    sel.innerHTML = '<option>Not available</option>'; sel.disabled = true;
    $('#voiceName').textContent = 'No speech engine';
    $('#voiceMeta').textContent = 'This browser can\'t read text aloud.';
    $('#voiceHint').textContent = 'Open ListenPDF in Chrome, Edge, or Safari to listen.'; $('#voiceHint').classList.add('warn');
    $$('[data-cmd="toggle"]').forEach(b => { b.disabled = true; }); $('#previewBtn').disabled = true;
    $('#mVoiceName').textContent = 'Unavailable';
    return;
  }
  if (!voices.length) {
    sel.innerHTML = '<option>System default</option>'; sel.disabled = true;
    $('#voiceName').textContent = 'System default voice';
    $('#voiceMeta').textContent = 'Your browser didn\'t list any voices.';
    $('#voiceHint').textContent = 'ListenPDF will use your system\'s default voice. Installing voices in your operating system adds more choices.';
    $('#mVoiceName').textContent = 'Default';
    return;
  }
  sel.disabled = false;
  const groups = new Map();
  voices.forEach(v => { const k = langLabel(v.lang); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(v); });
  const keys = [...groups.keys()].sort((a, b) => {
    const ab = groups.get(a)[0].lang.toLowerCase().startsWith(userBase), bb = groups.get(b)[0].lang.toLowerCase().startsWith(userBase);
    return ab === bb ? a.localeCompare(b) : ab ? -1 : 1;
  });
  sel.innerHTML = keys.map(k => `<optgroup label="${esc(k)}">${groups.get(k).map(v => `<option value="${esc(v.voiceURI)}">${esc(shortName(v))}${v.localService ? '' : ' (online)'}</option>`).join('')}</optgroup>`).join('');

  // Keep the chosen voice across voice-list refreshes. Never re-pick because of speed.
  const keepURI = (narrator.voice && narrator.voice.voiceURI) || prefs.voiceURI;
  let v = keepURI && voices.find(x => x.voiceURI === keepURI);
  if (!v) {
    const mine = voices.filter(x => x.lang.toLowerCase().replace('_', '-').startsWith(userBase));
    v = mine.find(x => x.default) || mine.find(x => x.localService) || mine[0] || voices.find(x => x.default) || voices[0];
  }
  narrator.voice = v;  // silent assignment, no restart
  sel.value = v.voiceURI;
  updateVoiceUI();
}
function updateVoiceUI() {
  const v = narrator.voice; if (!v) return;
  $('#voiceName').textContent = shortName(v);
  $('#voiceMeta').innerHTML = `${esc(langLabel(v.lang))}<span class="badge">${v.localService ? 'On device' : 'Online'}</span>`;
  $('#voiceHint').classList.remove('warn');
  $('#voiceHint').textContent = v.localService ? 'Changing speed never changes the voice.' : 'Online voices need an internet connection. Changing speed never changes the voice.';
  $('#mVoiceName').textContent = shortName(v);
}
$('#voiceSelect').addEventListener('change', e => {
  const v = voiceList.find(x => x.voiceURI === e.target.value); if (!v) return;
  narrator.setVoice(v); prefs.voiceURI = v.voiceURI; savePrefs(); updateVoiceUI();
});
$('#previewBtn').addEventListener('click', () => narrator.preview('Hello. This is how I will read your document.'));
$('#mVoice').addEventListener('click', () => {
  if (window.innerWidth <= 860) openDrawer('right');
  const s = $('#voiceSelect'); s.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => s.focus(), 250);
});

/* =====================================================================
   AudioPlayer / MiniPlayer / FullPlayer wiring
   ===================================================================== */
function syncRange(input) {
  const p = (input.value - input.min) / (input.max - input.min);
  input.parentElement.style.setProperty('--pf', clamp(p, 0, 1));
}
let dragging = null;
$$('.progress').forEach(inp => {
  inp.addEventListener('input', () => {
    dragging = inp; syncRange(inp);
    const t = narrator.totalTime() * inp.value / 1000;
    const box = inp.closest('.prog, .m-prog, .full-foot');
    if (box) { const c = box.querySelector('.t-cur'); if (c) c.textContent = fmtTime(t); }
  });
  inp.addEventListener('change', () => { dragging = null; userScrollAt = 0; narrator.seekTime(narrator.total * inp.value / 1000); followActive(); });
});

function updateProgress() {
  if (!doc) return;
  const cur = narrator.currentTime(), tot = narrator.totalTime();
  const f = narrator.total ? clamp(narrator.baseTime() / narrator.total, 0, 1) : 0;
  $$('.t-cur').forEach(el => { if (!dragging || !dragging.closest('.prog, .m-prog, .full-foot').contains(el)) el.textContent = fmtTime(cur); });
  $$('.t-rem').forEach(el => { el.textContent = '−' + fmtTime(tot - cur); });
  $$('.progress').forEach(inp => { if (inp !== dragging) { inp.value = Math.round(f * 1000); syncRange(inp); } inp.setAttribute('aria-valuetext', `${fmtTime(cur)} of ${fmtTime(tot)}`); });
  $('#mBar').style.width = (f * 100).toFixed(2) + '%';
}

let rafId = 0, lastTick = 0;
function loop(t) {
  if (!narrator.playing) { rafId = 0; return; }
  if (t - lastTick > 200) { lastTick = t; updateProgress(); narrator.watchdog(); }
  rafId = requestAnimationFrame(loop);
}

let lastFullI = -1;
function updateFull(i) {
  if ($('#full').hidden || !doc) return;
  const S = doc.segments;
  $('#fPrev').textContent = S[i - 1] ? S[i - 1].text : '';
  const c = $('#fCur'); c.textContent = S[i] ? S[i].text : '';
  if (i !== lastFullI) { c.classList.remove('swap'); void c.offsetWidth; c.classList.add('swap'); lastFullI = i; }
  $('#fNext').textContent = S[i + 1] ? S[i + 1].text : '';
}

narrator.on('segment', i => {
  setActive(i);
  updateSectionUI(i);
  updateFull(i);
  if (narrator.playing) {
    if (prefs.follow && Date.now() - userScrollAt > 4000) followActive();
    updateReturnPill();
  }
  savePosition();
});
narrator.on('position', () => updateProgress());
narrator.on('state', playing => {
  document.body.classList.toggle('is-playing', playing);
  $$('[data-cmd="toggle"]').forEach(b => b.setAttribute('aria-label', playing ? 'Pause' : 'Play'));
  $$('.play svg').forEach(s => { s.style.animation = 'none'; void s.offsetWidth; s.style.animation = ''; });
  $('#nowState').textContent = playing ? 'Playing' : narrator.ended ? 'Finished' : (narrator.index > 0 || narrator.offset > 0) ? 'Paused' : 'Ready to play';
  if (activeEl) { activeEl.classList.toggle('active', playing); activeEl.classList.toggle('cursor', !playing); }
  if (playing) { if (!rafId) rafId = requestAnimationFrame(loop); if (prefs.follow) { userScrollAt = 0; followActive(); } }
  updateProgress(); updateReturnPill(); savePosition(true);
});
narrator.on('end', () => { updateProgress(); Toast.show('Finished reading', 'You reached the end of the document. Press play to start again.', { type: 'ok' }); });
narrator.on('error', type => {
  const m = {
    blocked: ['Playback was blocked', 'Your browser needs a tap or click to start speech. Press play again.'],
    network: ['The online voice couldn\'t be reached', 'Check your connection, or choose an on-device voice in the Audio panel.'],
    failed: ['This voice stopped responding', 'Choose a different voice in the Audio panel, then press play.'],
  }[type] || ['Speech stopped unexpectedly', 'Press play to try again.'];
  Toast.show(m[0], m[1], { type: 'error', timeout: 9000 });
});

/* commands */
function command(cmd) {
  if (!doc) return;
  switch (cmd) {
    case 'toggle': narrator.toggle(); break;
    case 'back': narrator.skip(-15); if (narrator.playing) { userScrollAt = 0; } followActive(); break;
    case 'fwd': narrator.skip(15); if (narrator.playing) { userScrollAt = 0; } followActive(); break;
    case 'prevSec': jumpSection(-1); break;
    case 'nextSec': jumpSection(1); break;
    case 'cycleSpeed': cycleRate(); break;
    case 'full': openFull(); break;
  }
}
document.addEventListener('click', e => { const b = e.target.closest('[data-cmd]'); if (b && !b.disabled) command(b.dataset.cmd); });

/* volume */
const volEl = $('#volume');
volEl.value = narrator.volume; syncRange(volEl);
let lastVol = narrator.volume || 1;
function setVolIcon() { $('#muteBtn').innerHTML = narrator.volume === 0 ? Icons.mute : Icons.vol; $('#muteBtn').setAttribute('aria-label', narrator.volume === 0 ? 'Unmute' : 'Mute'); }
volEl.addEventListener('input', () => syncRange(volEl));
volEl.addEventListener('change', () => { const v = +volEl.value; if (v > 0) lastVol = v; narrator.setVolume(v); prefs.volume = v; savePrefs(); setVolIcon(); });
$('#muteBtn').addEventListener('click', () => { const v = narrator.volume === 0 ? lastVol : 0; if (narrator.volume > 0) lastVol = narrator.volume; volEl.value = v; syncRange(volEl); narrator.setVolume(v); prefs.volume = v; savePrefs(); setVolIcon(); });

/* full player */
function openFull() {
  const f = $('#full'); f.hidden = false; lastFullI = -1; updateFull(narrator.index); updateProgress();
  requestAnimationFrame(() => f.classList.add('open'));
  $('#fullClose').focus();
}
function closeFull() { const f = $('#full'); f.classList.remove('open'); setTimeout(() => { f.hidden = true; }, reduceMotion() ? 0 : 300); }
$('#fullClose').addEventListener('click', closeFull);

/* =====================================================================
   SettingsPanel + drawers
   ===================================================================== */
const setBtn = $('#settingsBtn'), setPop = $('#settings');
setBtn.addEventListener('click', e => { e.stopPropagation(); const open = setPop.hidden; setPop.hidden = !open; setBtn.setAttribute('aria-expanded', String(open)); });
document.addEventListener('click', e => { if (!setPop.hidden && !setPop.contains(e.target) && e.target !== setBtn) { setPop.hidden = true; setBtn.setAttribute('aria-expanded', 'false'); } });
$$('[data-theme-set]').forEach(b => b.addEventListener('click', () => { prefs.theme = b.dataset.themeSet; savePrefs(); applyTheme(); }));
$('#sizeDown').onclick = () => { prefs.size = clamp(prefs.size - 1, 15, 26); savePrefs(); applySize(); followActive(true, true); };
$('#sizeUp').onclick = () => { prefs.size = clamp(prefs.size + 1, 15, 26); savePrefs(); applySize(); followActive(true, true); };
const fSw = $('#followSwitch'), hSw = $('#headSwitch');
fSw.setAttribute('aria-checked', String(prefs.follow)); hSw.setAttribute('aria-checked', String(prefs.headings));
fSw.onclick = () => { prefs.follow = !prefs.follow; fSw.setAttribute('aria-checked', String(prefs.follow)); savePrefs(); if (prefs.follow) { userScrollAt = 0; followActive(); } };
hSw.onclick = () => { prefs.headings = !prefs.headings; narrator.skipHeadings = !prefs.headings; hSw.setAttribute('aria-checked', String(prefs.headings)); savePrefs(); };

const scrim = $('#scrim');
function openDrawer(side) { closeDrawers(); $(side === 'left' ? '#left' : '#right').classList.add('open'); scrim.classList.add('on'); }
function closeDrawers() { $('#left').classList.remove('open'); $('#right').classList.remove('open'); scrim.classList.remove('on'); }
$('#openLeft').onclick = () => openDrawer('left');
$('#openRight').onclick = () => openDrawer('right');
scrim.onclick = closeDrawers;
$$('[data-close]').forEach(b => { b.onclick = closeDrawers; });

/* =====================================================================
   Keyboard shortcuts
   ===================================================================== */
document.addEventListener('keydown', e => {
  if (els.reader.hidden || !doc || !$('#proc').hidden) return;
  if (e.key === 'Escape') {
    if (!$('#full').hidden) return closeFull();
    if (!setPop.hidden) { setPop.hidden = true; setBtn.setAttribute('aria-expanded', 'false'); return; }
    if (!$('#searchbar').hidden) return Search.close();
    return closeDrawers();
  }
  const t = e.target;
  if (t.closest && t.closest('input:not([type="range"]), textarea, select, [contenteditable="true"]')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const isRange = t.matches && t.matches('input[type="range"]');
  switch (e.key) {
    case ' ': e.preventDefault(); command('toggle'); break;
    case 'ArrowLeft': if (isRange) return; e.preventDefault(); e.shiftKey ? jumpSection(-1) : command('back'); break;
    case 'ArrowRight': if (isRange) return; e.preventDefault(); e.shiftKey ? jumpSection(1) : command('fwd'); break;
    case '[': e.preventDefault(); stepRate(-1); break;
    case ']': e.preventDefault(); stepRate(1); break;
    case '/': e.preventDefault(); Search.open(); break;
    case 'f': case 'F': e.preventDefault(); $('#full').hidden ? openFull() : closeFull(); break;
  }
});

/* =====================================================================
   Continue where you left off
   ===================================================================== */
let saveTimer = 0;
function savePosition(now = false) {
  if (!doc) return;
  const write = () => {
    const i = narrator.index, seg = doc.segments[i];
    Store.set('pos:' + doc.key, { i, t: Date.now() });
    const rec = Store.get('recents', []).filter(r => r.key !== doc.key);
    rec.unshift({ key: doc.key, name: doc.name, pages: doc.numPages, page: seg ? seg.page : 1, progress: doc.segments.length ? i / doc.segments.length : 0, at: Date.now(), sample: !!doc.sample });
    Store.set('recents', rec.slice(0, 5));
  };
  clearTimeout(saveTimer);
  if (now) write(); else saveTimer = setTimeout(write, 900);
}
window.addEventListener('pagehide', () => savePosition(true));

function renderRecents() {
  const rec = Store.get('recents', []);
  const box = $('#recents');
  if (!rec.length) { box.hidden = true; return; }
  box.hidden = false;
  $('#recentList').innerHTML = rec.map((r, k) => `<button type="button" class="recent" data-k="${k}">
    ${Icons.pdf}
    <div style="min-width:0"><div class="r-name">${esc(r.name)}</div><div class="r-sub">Page ${r.page} of ${r.pages}</div><div class="r-bar"><i style="width:${Math.round(r.progress * 100)}%"></i></div></div>
    <span class="r-act">${r.sample ? 'Open' : 'Choose file'}</span></button>`).join('');
  $$('#recentList .recent').forEach(b => b.onclick = () => {
    const r = rec[+b.dataset.k];
    if (r.sample) openSample();
    else { Toast.show(`Choose "${r.name}"`, 'Files never leave your device, so pick it again and ListenPDF will resume from your saved page.', { timeout: 7000 }); els.fileInput.click(); }
  });
}

/* =====================================================================
   Sample document (lets people try the flow without a PDF)
   ===================================================================== */
const SAMPLE = [
  [{ h: 1, t: 'The Quiet Craft of Listening' },
    'For most of history, reading was something people did out loud. Monks murmured over manuscripts, families gathered around a single book, and letters were read to those who could not read them. Silent reading, the kind we now treat as normal, arrived surprisingly late.',
    'Listening to a text asks something different of us than reading it. The pace is set for you, so your attention has to arrive on time. In exchange, your hands and eyes are free, and a long document can travel with you on a walk, a commute, or a slow evening.',
  { h: 2, t: 'Why the ear remembers' },
    'Spoken language carries rhythm, emphasis, and pause. These cues help the listener group words into ideas, which is part of why a well-read passage can feel easier to follow than the same words on a page. The voice does some of the structuring work that the eye would otherwise do alone.'],
  ['Of course, the ear has limits. It is poor at scanning, and it cannot glance back at a figure or a table. That is why the best listening tools keep the text in view, marking each sentence as it is spoken, so you can look up at any moment and find your place.',
    { h: 2, t: 'Choosing a pace' },
    'There is no correct speed. Dense arguments reward a slower pace, while familiar material can be taken quickly. Many listeners find that their comfortable speed rises over a few weeks, the same way reading speed improves with practice.',
    'Whatever pace you choose, the voice itself should stay the same. A change in speed is a change in tempo, not a change in narrator.'],
  [{ h: 2, t: 'Picking up where you left off' },
    'Long documents are rarely finished in one sitting. A good reader remembers where you stopped, so you can return tomorrow without hunting for the paragraph you were in. Small conveniences like this are what turn a file into something you actually finish.',
    'Press play, lean back, and let the page read itself to you.'],
];
function openSample() {
  const pages = SAMPLE.map((items, pi) => ({
    num: pi + 1, height: 1e6,
    lines: items.map((it, k) => typeof it === 'string'
      ? { text: it, size: 10, x: 0, y: 5e5 - k * 40, w: 500 }
      : { text: it.t, size: it.h === 1 ? 18 : 14, x: 0, y: 5e5 - k * 40, w: 300 }),
  }));
  const built = TextProcessor.build(pages);
  openDocument({ key: 'sample-v1', name: 'The Quiet Craft of Listening (sample)', title: 'The Quiet Craft of Listening', size: 0, numPages: pages.length, thumb: null, sample: true, ...built });
}
$('#sampleBtn').addEventListener('click', openSample);

/* landing specimen: the one orchestrated motion on the landing page */
let specTimer = 0;
function startSpecimen() {
  stopSpecimen(); if (reduceMotion()) return;
  const spans = $$('#specText .s'); let k = 0;
  specTimer = setInterval(() => { spans[k].classList.remove('active'); k = (k + 1) % spans.length; spans[k].classList.add('active'); }, 2800);
}
function stopSpecimen() { clearInterval(specTimer); }

/* network status */
window.addEventListener('offline', () => Toast.show('You\'re offline', 'On-device voices keep working. Online voices will pause until you reconnect.'));

/* =====================================================================
   Boot
   ===================================================================== */
hydrateIcons();
setVolIcon();
updateRateUI(false);
renderRecents();
startSpecimen();
provider.onVoicesChanged(v => populateVoices(v));
provider.init().then(populateVoices);
