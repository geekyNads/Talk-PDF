# Talk PDF

Read less. Listen more. Turn any PDF into an audiobook, right in the browser.

## Run it

No build step. Serve the folder with any static server, then open it in Chrome, Edge, or Safari:

```bash
cd Talk-PDF
python3 -m http.server 8080
# open http://localhost:8080
```

Opening `index.html` straight from disk also works in most browsers. A local server is more reliable, especially for the optional OCR fallback.

## Files

- `index.html`: markup for the landing page, reader, players, and dialogs
- `css/styles.css`: design tokens (dark and Paper themes), layout, and responsive rules
- `js/app.js`: application logic, organized into modules:
  - `PDFProcessor`: extracts text and page structure with pdf.js
  - `OCRProcessor`: lazy-loaded tesseract.js fallback for scanned PDFs
  - `TextProcessor`: detects headings, paragraphs, and sentences, and removes running headers and footers
  - `TTSProvider` / `WebSpeechProvider`: pluggable text-to-speech layer
  - `Narrator`: playback engine (chunking, seeking, speed, voice, and position)
  - UI modules: uploader, document viewer, contents, highlighter, search, voice selector, speed controller, player, mini player, full-screen player, and settings

## Adding a TTS provider

Extend `TTSProvider` and implement `init`, `getVoices`, `speak(text, opts)`, `cancel`, `isSpeaking`, and `prepare(nextText)`. Audio-file providers should prefetch the next chunk in `prepare`. Then pass your provider to `new Narrator(provider)`.

## Notes

- PDFs are processed locally. Nothing is uploaded to a server.
- Voices come from the browser and operating system through the Web Speech API. Edge "Natural" voices and Chrome's Google voices sound best.
- Elapsed and remaining times are estimated from an average reading pace.
- Preferences and reading positions are saved in `localStorage`.
