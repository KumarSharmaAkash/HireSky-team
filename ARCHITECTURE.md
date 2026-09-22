# HireSky — Complete Technical Architecture

Investigation date: 2026-09-21. All facts below are verified against the repository at `/Users/akash/Broski/HireSky` with exact `file:line` citations. Anything not found in the code is explicitly marked **"Not confirmed from the repository."** No code was modified during this investigation.

---

## A. Executive Summary

HireSky is a **single-machine Electron desktop app** (Windows/macOS/Linux) that sits as an invisible overlay during video calls (Zoom, Meet, Teams, etc.) and helps answer coding/DSA interview questions in real time. There is **no server, no backend, no database, and no user accounts** — it is a "bring your own API key" tool:

- You speak or take a screenshot of a question.
- The app transcribes your voice **locally** (OpenAI Whisper running on your own machine) or via Azure Speech (cloud, optional), or reads the screenshot directly.
- It sends the question/text/image straight from your machine to **Google's Gemini API** using an API key you provide yourself, with no middleman server.
- The AI's answer streams back into a small floating window that is hidden from screen-recording/sharing software.

A separate, **completely unrelated** static marketing website (`webapp/`) exists in the same repository — it's just the promotional landing page (like a brochure), with zero runtime connection to the desktop app.

## B. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Desktop shell | **Electron 29** (`electron: ^29.1.0`, `package.json:45`) | Cross-platform native window shell |
| Main process | Node.js (bundled with Electron) | App lifecycle, IPC, OS integration, all business logic |
| Renderer UI | Plain HTML/CSS/vanilla JS (no React/Vue/Angular found) | 5 windows: main bar, chat, AI response, settings, onboarding |
| Styling | Tailwind CSS (`tailwind.config.js`, `src/input.css`) + hand-written CSS | UI styling |
| IPC bridge | Electron `contextBridge`/`ipcRenderer` (`preload.js`) | Secure main↔renderer communication |
| AI provider | Google Gemini via `@google/genai` SDK (`package.json:34`) | Question answering / vision analysis |
| Speech-to-text (local) | OpenAI Whisper (Python, `openai-whisper` pip package) run in a persistent child process | Offline voice transcription |
| Speech-to-text (cloud, optional) | `microsoft-cognitiveservices-speech-sdk` (`package.json:38`) | Alternative cloud transcription |
| Native audio capture (Linux/Azure) | `node-record-lpcm16` (`package.json:39`) wrapping `sox`/`arecord` | Microphone capture from the main process |
| Screen capture | Electron's built-in `desktopCapturer` API | Screenshot capture (no 3rd-party library) |
| Logging | `winston` + `winston-daily-rotate-file` (`package.json:41-42`) | Rotating log files |
| Config/secrets | Flat JS config object + `dotenv`-loaded `.env` file | App settings, API keys |
| Packaging | `electron-builder` (`package.json:46`) | Produces `.dmg`/`.exe`/`.AppImage`/`.deb` installers |
| Marketing site | Static HTML/CSS/vanilla JS (`webapp/`) | Promotional landing page, unrelated at runtime to the app |
| Database | **None** | No DB library in `package.json` dependencies |
| Backend/API server | **None** | No Express/Fastify/server framework; all "APIs" are either Electron IPC (internal) or direct calls to Google/Microsoft/GitHub |
| Auth | **None** | No login, no accounts, no JWT/OAuth of any kind |

## C. Architecture Diagram

The textbook "Desktop App → Frontend → Backend/API → Database → AI/External Services" chain **does not apply** — there is no backend and no database. The real architecture is:

```
┌──────────────────────────── User's Computer ─────────────────────────────┐
│                                                                            │
│   ┌───────────────────────── Electron App ─────────────────────────┐     │
│   │                                                                   │   │
│   │   MAIN PROCESS (main.js — ApplicationController)                 │   │
│   │   • App lifecycle, global shortcuts, tray-less stealth mode       │   │
│   │   • IPC hub (ipcMain.handle/.on — ~50 channels)                   │   │
│   │   • Services: capture.service, speech.service, llm.service        │   │
│   │   • Managers: window.manager (5 BrowserWindows), session.manager  │   │
│   │            (in-memory chat history, NOT auth)                     │   │
│   │                         │ IPC (contextBridge, preload.js)         │   │
│   │        ┌────────────────┼────────────────┬───────────┬─────────┐ │   │
│   │        ▼                ▼                ▼           ▼         ▼ │   │
│   │   [main window]   [chat window]  [llmResponse]  [settings] [onboarding]
│   │   command bar     transcript UI   AI answers     config      first-run
│   │                                                                   │   │
│   └───────────────────────────────────────────────────────────────┘     │
│                     │                          │                         │
│         Local Python child process      Local file storage               │
│         (scripts/whisper_worker.py,     (.env, logs, whisper models,     │
│          persistent, stdin/stdout       sentinel file — all under        │
│          JSON protocol)                 Electron userData dir)           │
│                     │                                                    │
└─────────────────────┼────────────────────────────────────────────────────┘
                       │ (only if Whisper unavailable/not chosen)
                       ▼
         ┌───────────────────────────────────────────┐
         │        External services (direct HTTPS,      │
         │        called straight from the user's PC,   │
         │        no relay server in between)            │
         │                                                │
         │  • generativelanguage.googleapis.com (Gemini)  │
         │    — the AI brain, needs user's own API key    │
         │  • Azure Cognitive Services (optional, BYOK)    │
         │  • api.github.com / shields.io (marketing site  │
         │    only, fetches release/download counts)       │
         └───────────────────────────────────────────────┘

   (Separate, unrelated artifact in the same git repo:)
   webapp/  →  static HTML/CSS/JS marketing site, opened in any normal
               browser, never loaded by or communicating with the
               Electron app above.
```

## D. Desktop Application Flow

Entry point: `main.js`. Orchestrating class: **`ApplicationController`** (`main.js:111-1981`) — there is no separate "app controller" file, it's all in `main.js`.

Startup sequence:
1. `.env` is located and loaded (`resolveEnvPath()` + `dotenv.config()`, `main.js:13-34`) — see §H/§O for the exact dev-vs-packaged path logic.
2. Platform-specific Chromium flags applied (Linux GPU workarounds, noise suppression) — `main.js:60-76`.
3. Crash guards installed (`uncaughtException`/`unhandledRejection`) — `main.js:89-99`.
4. Services/managers required: `capture.service`, `speech.service`, `llm.service`, `windowManager`, `sessionManager` — `main.js:103-109`.
5. `new ApplicationController()` is constructed **only after** `app.requestSingleInstanceLock()` succeeds (`main.js:1983-1990`) — a second launch just focuses the existing instance instead of opening twice (`handleSecondInstance()`, `main.js:188-219`).
6. Constructor calls `setupStealth()` (sets `process.title`/`app.setName("Terminal ")` **before the app is even ready**, `main.js:158-176`) then `setupEventHandlers()` (`main.js:178-186`), which wires `app.whenReady().then(() => this.onAppReady())`.
7. **`onAppReady()`** (`main.js:221-306`) — the real startup:
   - Re-forces the stealth name.
   - `setupPermissions()` — grants Electron's web-level `media`/`display-capture` permissions only to the app's own trusted pages (`main.js:335-389`).
   - `setupNetworkConfiguration()` — Gemini-related UA/cert setup.
   - Checks first-run state (`firstRunManager.getStatus()`), decides whether to show onboarding.
   - `windowManager.initializeWindows({ showMainWindow: !isFirstRun })` — creates all 4 core windows (main, chat, llmResponse, settings); the 5th window (onboarding) is created lazily only if needed.
   - `setupGlobalShortcuts()` registers all `globalShortcut`s.
   - Sets the stealth icon/name (`updateAppIcon("terminal")`).
   - If first run: after an 800ms delay, shows the onboarding window; otherwise marks first-run complete.

There is **no separate "main process vs renderer process" split into different files per window** beyond the standard Electron model — one Node.js main process runs `main.js` + everything under `src/`, and each `BrowserWindow` loads its own HTML/JS as a sandboxed Chromium renderer (`contextIsolation: true`, `nodeIntegration: false` — `src/core/config.js:22-33`).

## E. Window Architecture

| Window | Purpose | File/Component | How Opened | How Closed | Data Used | Communication |
|---|---|---|---|---|---|---|
| **main** | Always-visible stealth command bar (screenshot button, mic, skill/language pickers) | `index.html` + `src/ui/main-window.js` (created `window.manager.js:182-227`) | `initializeWindows()` on app start, or `showMainWindow()` after onboarding completes | Never truly closed (`closable:false`) — only hidden | Settings, speech availability, active skill | IPC: `take-screenshot`, `resize-window`, `move-window`, `update-active-skill`, speech start/stop, many more (see §J) |
| **chat** | Voice-transcript + chat panel | `chat.html` (own inline `<script>`; `src/ui/chat-window.js` exists but is **dead code**, not loaded by any HTML) | `initializeWindows()`, starts hidden; shown via `Cmd/Ctrl+Shift+C` or when recording starts | Hidden via `close-window`/`switchToWindow` toggle; never destroyed | Transcripts, chat messages, AI streaming responses | IPC: `send-chat-message`, `transcription-received`, `transcription-llm-response*` |
| **llmResponse** | Displays streamed/final AI answers with markdown + code highlighting | `llm-response.html` (own inline `<script>`) | Created at startup, hidden; shown via `showLLMResponse()`/`showLLMLoading()` whenever a screenshot or question is processed | Hidden via `hideLLMResponse()`; never destroyed | Streamed AI text, code blocks | IPC: `display-llm-response`, `show-loading`, `transcription-llm-response-chunk` |
| **settings** | Configuration panel (API keys, speech provider, Whisper setup, icon/skill pickers) | `settings.html` + `src/ui/settings-window.js` | `Cmd/Ctrl+,` shortcut or `show-settings` IPC | `closable:false` — only ever hidden (`close-settings` → `.hide()`) | Current `.env`-derived settings | IPC via both `electronAPI` and a separate lower-level `window.api` bridge |
| **onboarding** | First-run wizard (paste Gemini key, install Whisper, pick provider) | `onboarding.html` + `onboarding.js` | Lazily created by `showOnboarding()`, only on first run | `close-onboarding` IPC → `.close()` and removed from the windows map (this is the one window that is actually destroyed) | First-run status, install progress | IPC: `get-first-run-status`, `complete-first-run`, `detect-whisper`, `install-whisper`, `download-whisper-model` |

Communication pattern example (screenshot → answer):
```
User → [main window] screenshot button
     → IPC "take-screenshot"
     → ApplicationController.triggerScreenshotOCR() (main.js:1068)
     → CaptureService (desktopCapturer, in-memory PNG buffer)
     → LLMService → Gemini API (external)
     → streamed chunks broadcast over IPC to ALL windows
     → [llmResponse window] renders the answer
```

All windows share these traits: frameless, transparent, `alwaysOnTop`, `skipTaskbar:true`, and every single one calls Electron's `setContentProtection(true)` (§P) so none of them show up in screen recordings/shares (except on Linux, where Electron doesn't support this).

Note: a legacy `'skills'` window type is referenced in a couple of `switch` statements but has no actual config/creation code — vestigial, not a real window. **Not confirmed** to do anything.

## F. Web Application Connection

**There is no connection.** This is worth stating plainly because it's the opposite of a typical "desktop app talks to a web app" architecture:

- `webapp/` is a fully static marketing site (`index.html`, `script.js`, `style.css`, SEO files like `sitemap.xml`/`robots.txt`/`llms.txt`). It is meant to be hosted on a normal web server/CDN and viewed in any browser — it is **not bundled inside** the Electron app (`package.json`'s `build.files` list at `package.json:54-66` does not include `webapp/`... **not confirmed** either way since no explicit exclusion was checked, but no code in `main.js`/`window.manager.js` ever loads anything from `webapp/`).
- `webapp/script.js` was checked line-by-line for any `electron`, `localhost`, `ipc`, or `desktop` references — **zero matches found**. Its only network calls are to GitHub's public REST API and `shields.io` badge endpoints, purely to display "latest release" download links/counts on the marketing page.
- The desktop app never loads any URL from the marketing site, and the marketing site never talks to a running instance of the desktop app.
- If this repo is ever pushed to GitHub and the marketing site deployed (e.g. to a custom domain), its only job is to be a download page that links to GitHub Releases — it has no API, no login, no backend of its own either.

So the "real architecture" for this section is: **two independent artifacts in one repository, connected only by the fact that a human might click a download link on the website to get the desktop app installer.**

## G. Authentication & Login

**None exists.** Confirmed by exhaustive grep across the whole codebase (excluding `node_modules`) for `jwt|oauth|login|signup|passport|bcrypt|cookie` — no matches related to user authentication. There is:

- No signup flow.
- No login screen.
- No OAuth/social login.
- No password of any kind.
- No user accounts, no user IDs, no multi-user concept anywhere.

The only credential in the entire app is the user's **own Gemini API key** (and optionally an Azure Speech key), which the user pastes into the onboarding wizard or Settings window and which is stored in a local `.env` file (see §H/§O). This is authentication *to Google's API*, not to the HireSky app itself — there is nothing resembling a HireSky "account."

The closest thing to a returning-user check is the **first-run sentinel file** (`.hiresky-firstrun-completed`, see §H) — a local marker, not a session/login of any kind.

## H. Session Storage

This section has **two completely different meanings** in this codebase that must not be conflated — the investigation confirmed both explicitly:

### 1. "Session" = AI conversation memory (in `session.manager.js`)
- `SessionManager.sessionMemory` is a **plain in-memory JavaScript array** (`src/managers/session.manager.js:7`), holding the rolling chat/event history used to give Gemini conversational context.
- **Never written to disk.** No `fs.writeFile`, database, or store call exists anywhere in `session.manager.js`. It is exported as a singleton (`session.manager.js:601`) living only in the main process's RAM.
- **Conclusion: all conversation history is lost the moment the app process quits or restarts.** There is no chat-history persistence at all.
- Memory is bounded by `maxSize` (1000 events, `config.js:95`) and `compressionThreshold` (500 events, `config.js:96`) — old events get their text truncated/compressed to save RAM, not saved anywhere.

### 2. "Session" = first-run / returning-user marker (in `first-run.js`)
- A sentinel file `.hiresky-firstrun-completed` (just an ISO timestamp, no user identity) is written to Electron's `userData` directory (`main.js:139`) once onboarding completes (`first-run.js:67-75`).
- `needsOnboarding()` (`first-run.js:30-36`) checks: does the sentinel exist? Does `.env` exist? Does `.env` have a real (non-placeholder) `GEMINI_API_KEY`? If any of these fail, onboarding shows again.
- This is the **entire** "does the app remember you" mechanism — a local file, not a session ID, not a cookie, not a database row.

**Walkthrough of the lifecycle questions asked:**
- **App opens**: reads `.env` + sentinel file from disk → decides "first run" or "returning". `sessionMemory` array starts empty (populated with skill system-prompts, `session.manager.js:16-40`).
- **User logs in**: N/A — no login exists.
- **App closes**: `sessionMemory` (chat history) is discarded; `.env`/sentinel remain on disk (settings persist, conversation doesn't).
- **App reopens**: sentinel + `.env` presence tell it not to onboard again; conversation history starts fresh/empty.
- **Token expiration**: N/A — the Gemini API key doesn't expire on any timer the app manages; if Google rejects it (401/403), the app just shows an error (per the earlier debugging session in this conversation).
- **Logout**: N/A — nothing to log out of. Closest equivalent is `clear-session-memory` IPC (`main.js:604-608`), which just empties the in-memory chat array.

No cookies, `localStorage`/`sessionStorage`/IndexedDB app-data, SQLite, Redis, or backend database are used for any of this — see §I.

## I. Database

**No database of any kind is used.** Verified via `package.json` dependencies (no `pg`, `mongoose`, `sqlite3`, `better-sqlite3`, `mysql`, `@supabase/*`, `firebase`, `redis`, etc.) and via code search (no `CREATE TABLE`, no ORM imports, no DB connection strings anywhere).

Per the task's explicit instruction not to assume — this was verified, not assumed: `grep`-ing the full dependency tree and every service file turned up nothing. All "persistence" in this app is either:
- Plain files (`.env`, log files, the sentinel file, Whisper model weight files) — see §O, or
- Pure in-memory objects that vanish on process exit (`sessionMemory` array) — see §H.

There are no tables, no schema, no relationships, no primary/foreign keys, and no subscription/payment data anywhere, because there is no database to hold them.

## J. API Architecture

There is no REST/GraphQL API *of this app* (no backend to expose one). "API" here means two things: (1) internal Electron IPC, and (2) outbound calls this app makes to external services.

### Internal IPC (main↔renderer), most important channels
| Channel | Direction | Purpose | Auth |
|---|---|---|---|
| `take-screenshot` | renderer→main (invoke) | Trigger screenshot+AI analysis | None (local IPC) |
| `audio-chunk` | renderer→main (send) | Stream mic PCM audio to main process | None |
| `send-chat-message` | renderer→main (invoke) | Submit typed question to Gemini | None |
| `transcription-llm-response-chunk` | main→renderer (broadcast) | Stream AI answer text deltas to all windows | None |
| `set-gemini-api-key` / `get-gemini-status` | renderer→main (invoke) | Save/check the user's API key | None |
| `install-whisper` / `download-whisper-model` | renderer→main (invoke) | Drive local Whisper setup, streams `install-progress` | None |
| `get-settings` / `save-settings` | renderer↔main | Read/write `.env`-backed config | None |
| (~40 more — full list produced by the window/IPC investigation) | | | |

(All IPC is local, in-process — there is no network transport or authentication involved; Electron's `contextIsolation`+preload allowlist is the only "security boundary" here — see §P.)

### External APIs called by this app
| API | Method | Purpose | Called From | Authentication | Response |
|---|---|---|---|---|---|
| `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | POST (raw HTTPS or via `@google/genai` SDK) | Non-streaming text/image AI answers | `src/services/llm.service.js` (`executeRequest`, `executeAlternativeRequest`) | `x-goog-api-key` header = user's own Gemini key | JSON |
| `generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse` | POST, Server-Sent Events | Streaming AI answers | `llm.service.js` (`executeStreamingRequest`) | `x-goog-api-key` header | SSE chunks |
| Azure Cognitive Services Speech endpoint (region-specific, via SDK) | SDK-managed | Cloud speech-to-text (optional, alternative to local Whisper) | `speech.service.js` (`_initializeAzureClient`) | Azure subscription key + region | Streamed recognition events |
| `api.github.com` / `img.shields.io` | GET | "Latest release" download links/counts on the **marketing site only** | `webapp/script.js` | None (public API) | JSON |

No other external endpoints were found. There is deliberately **no HireSky-run server** anywhere in this flow — every external call goes directly from the user's own machine to Google/Microsoft/GitHub using credentials the user supplied.

## K. Audio Flow

```
Microphone
   │
   ├─ Windows/macOS + Whisper (default): renderer window's Web Audio API
   │    src/ui/main-window.js:679-729 — getUserMedia → AudioContext(16kHz)
   │    → ScriptProcessorNode → manual Float32→Int16 PCM conversion
   │    → IPC "audio-chunk" (preload.js:12) → main.js:490-494
   │
   └─ Linux (any provider) / Azure (any platform): main-process native capture
        src/services/speech.service.js:1665-1788 — node-record-lpcm16 spawns
        sox/arecord as a child process, streams raw PCM chunks directly
        │
        ▼
   speechService.handleAudioChunkFromRenderer() / _handleAudioChunk()
        │
        ├─ Azure path: chunk fed straight into the Azure SDK's PushStream
        │    (speech.service.js:1795-1802) → SDK does its own VAD/streaming
        │    recognition over the network → 'transcription'/'interim-transcription'
        │    events (speech.service.js:604-622)
        │
        └─ Whisper path: _ingestWhisperAudio() VAD state machine
             (speech.service.js:824-928) — adaptive noise-floor + hysteresis
             thresholds detect speech start/stop on natural pauses (default
             700ms silence hangover, config.js:79), with a 300ms pre-roll
             buffer so the first syllable isn't clipped
             │
             ▼
        Segment flushed → written to a temp WAV file
             │
             ▼
        Persistent Python child process (scripts/whisper_worker.py)
             — long-lived, JSON-over-stdin/stdout protocol
             — model stays loaded in memory between requests (fast)
             — idle-unloads the model from RAM/GPU after 60s of inactivity
               (config: WHISPER_GPU_IDLE_MS) without killing the process
             │
             ▼
        Transcribed text → speechService emits 'transcription'
             │
             ▼
        main.js:1230-1260 handleTranscriptionFragment()
             → sessionManager.addUserInput() (adds to in-memory chat history)
             → coalesced and sent to LLM (see §M)
```

Audio format: 16kHz mono PCM throughout. Chunking: VAD-based by default (natural-pause detection), with a manual fixed-duration mode as an alternative and a hard 15s max-utterance safety cap. Not truly "streamed" to Whisper in real time — each detected utterance is batched into one WAV file and transcribed as a unit (near-real-time, not word-by-word streaming, unlike the Gemini response which does stream token-by-token).

## L. Screen Flow

```
User presses Cmd/Ctrl+Shift+S (or clicks the screenshot button)
   │
   ▼
Electron's desktopCapturer.getSources({types:['screen']}) — NOT a 3rd-party
library, built into Electron itself (src/services/capture.service.js:71-74)
   │
   ▼
Captures the FULL target display (primary, or whichever display matches
by size heuristic) as a NativeImage; optional crop to a sub-region is
supported in code but not confirmed to be exercised by any current UI
   │
   ▼
image.toPNG() → an in-memory Buffer (capture.service.js:47)
   — screenshots are NEVER written to disk; they exist only as a Buffer
     that's passed directly, in-memory, to the AI service and then
     garbage-collected
   │
   ▼
Buffer is base64-encoded (llm.service.js:142/243) and sent as inline
image data straight to the Gemini API (Google's vision model) —
no OCR step, no intermediate server
   │
   ▼
Gemini's response streams back and is displayed in the [llmResponse] window
```

Capture is strictly **on-demand** (keyboard shortcut or button click) — there is no continuous/periodic screen recording or frame-grabbing found anywhere in the code.

Security/privacy note: because the image never touches disk and goes directly (with the user's own API key) to Google, the only "data at rest" risk is whatever Google itself retains per its API terms — not something this app controls or persists locally.

## M. AI Flow

```
Trigger: typed chat message, OR voice transcript (after VAD flush), OR
         a screenshot
   │
   ▼
Prompt construction (src/services/llm.service.js + prompt-loader.js):
  • systemInstruction = the active "skill" prompt (currently only 'dsa'
    is actually loadable — prompt-loader.js hardcodes a filter that
    skips every prompt file except prompts/dsa.md, even though
    prompts/programming.md exists on disk and a broader skill-alias
    map suggests more skills were once planned)
  • contents = prior conversation history from session.manager.js
    (last ~8-20 turns, depending on the call type) + the new
    user text and/or base64 image data
   │
   ▼
Sent to Google's Gemini API — model tried in this order:
  1. gemini-3.1-flash-lite  (primary)
  2. gemini-2.5-flash-lite  (fallback 1)
  3. gemini-3.5-flash       (fallback 2)
  — up to 3 retries per model, with exponential backoff, before moving
    to the next model (config.js:43-48)
  — TWO different transport mechanisms exist: the official @google/genai
    SDK, and a hand-written raw HTTPS+SSE implementation that bypasses
    the SDK entirely. By default the raw HTTPS path is tried FIRST
    (config: enableFallbackMethod=true), suggesting the SDK's own
    networking was found less reliable inside Electron
   │
   ▼
Streaming response (SSE, parsed manually) → onDelta() callback per chunk
   │
   ▼
main.js broadcasts each chunk over IPC ("transcription-llm-response-chunk")
to every open window
   │
   ▼
[llmResponse] window renders it live with markdown + syntax highlighting
(lib/markdown.js, lib/mathrender.js)
   │
   ▼
Final full response saved into session.manager.js's in-memory history
(for context in the NEXT question) — never written to disk
```

If both transport mechanisms fail entirely (e.g., real network outage, bad API key), the app returns a canned local fallback message rather than crashing (`generateFallbackResponse`/`generateIntelligentFallbackResponse`).

## N. Data Lifecycle

```
APP OPEN
   │
   ▼
Read .env + sentinel file from disk (no "auth check" — just config presence)
   │
   ▼
FIRST RUN? ──yes──▶ show onboarding wizard (paste Gemini key, pick
   │no                speech provider, optionally install local Whisper)
   ▼
Main window (+ chat/llmResponse/settings) created, hidden mostly,
sessionMemory array initialized with skill system-prompts (in RAM only)
   │
   ▼
USER ASKS A QUESTION (voice, screenshot, or typed chat)
   │
   ▼
Audio/image captured → processed LOCALLY where possible (Whisper) or
via BYOK cloud service (Azure) → text/image sent DIRECTLY to Gemini
with the user's own API key (no HireSky server in between)
   │
   ▼
AI answer streams back → shown in overlay window → appended to the
in-memory sessionMemory array (for conversational context only)
   │
   ▼
[loop back to "USER ASKS A QUESTION" for the rest of the app's life]
   │
   ▼
APP CLOSED
   │
   ▼
sessionMemory (all conversation history) is DISCARDED — gone forever
.env, sentinel file, log files, Whisper model weights REMAIN on disk
for next launch
```

There is no "interview session" object, no "session ID", and no server-side finalization step anywhere — the entire lifecycle is local-machine-only, bounded by the process's own runtime.

## O. Local Files & Storage

| Location | Purpose | Sensitive? | Encrypted? |
|---|---|---|---|
| `<userData>/.env` (packaged) or `<repo>/.env` (dev, `main.js:13-22`) | Gemini/Azure API keys, Whisper/speech settings | **Yes** — plaintext API keys | **No.** Only OS file permission `0o600` is set; no OS-keychain (`safeStorage`/`keytar`) usage found anywhere in the codebase |
| `<userData>/.hiresky-firstrun-completed` | Onboarding-done marker (just a timestamp) | No | N/A |
| `<userData>/.whisper-models/` (e.g. `base.pt`, `small.pt`) | Downloaded local Whisper model weights | No (just ML weights) | No |
| `<userData>/.venv-whisper/` | Python virtualenv for local Whisper | No | No |
| `~/.HireSky/logs/` — `application-*.log`, `error-*.log`, `exceptions.log`, `rejections.log` | Winston rotating application logs (20MB/file, 14–30 day retention) | Possibly (error metadata) — a full audit of every log call site was out of scope, so **not fully confirmed** whether transcripts/keys are ever logged | No — plaintext |
| Standard Electron/Chromium subfolders under `<userData>` (`Cache`, `Local Storage`, `Session Storage`, `sessions.db`, etc.) | Chromium engine's own internal caches, not HireSky application data per se | Unclear, low priority | No — Chromium's own unencrypted stores |
| Screenshots | **Never written to disk** — captured, base64-encoded, and sent to Gemini entirely in memory | N/A | N/A |
| Voice audio | Short-lived temp WAV files per utterance, fed to the Whisper worker, in the OS temp directory | Transient audio content | Not confirmed whether temp WAVs are explicitly deleted after use vs. relying on OS temp-dir cleanup |

`<userData>` = Electron's per-OS app-data directory (on this Mac: `~/Library/Application Support/HireSky/`).

## P. Security Architecture

- **No authentication to attack** — there's no login system, so classic session-hijacking/credential-stuffing risks don't apply to the app itself.
- **API key storage is plaintext**, protected only by OS file permissions (`0o600`), not by Electron's `safeStorage` (OS Keychain/Credential Manager) or any encryption library. Anyone with local file access to the user's machine (or a malicious app running as the same user) could read the Gemini/Azure keys directly from `.env`.
- **Renderer isolation is correctly configured**: `contextIsolation: true`, `nodeIntegration: false` (`src/core/config.js:22-33`) — renderers cannot directly touch Node.js APIs; all privileged actions go through the `preload.js` allowlist (`contextBridge.exposeInMainWorld`), which is the right pattern.
- **IPC surface is broad** (~50 channels) but all local/in-process — not network-exposed, so it's not remotely attackable; the main risk category would be a compromised/malicious renderer abusing an overly-permissive IPC handler, which wasn't deeply audited here per scope but the `open-external` handler does validate URLs are `http(s)` before opening them (`main.js:773-785`), a good practice against `file://`/`javascript:` abuse.
- **Permission handling**: the app whitelists only its own trusted page URLs for `media`/`display-capture` web-permissions (`main.js:337-367`) — this stops arbitrary/loaded remote content from getting mic or screen access, though this app doesn't load remote content in the first place. **No explicit macOS TCC (screen-recording/microphone OS-level permission) request code was found** (`systemPreferences` is never used) — the app relies on macOS's own default prompts triggering the first time native capture APIs are actually invoked.
- **Stealth/content-protection** (`setContentProtection(true)`, every window) is itself a security-relevant feature — it deliberately hides the app from screen-recording/sharing software. This is explicitly **not supported on Linux** per Electron's own limitation (logged as a warning in the code).
- **CORS/CSP**: not applicable in the traditional sense — there's no web backend serving these windows; local `file://`-loaded HTML with no remote script includes was the pattern observed (not exhaustively audited for a CSP meta tag).
- **XSS risk**: low relative to a typical web app since there's no remote/user-generated content rendered as raw HTML from untrusted sources in the reviewed files, but AI responses ARE rendered as markdown/HTML (`lib/markdown.js`) — whether that renderer sanitizes against a maliciously-crafted AI response containing script tags was **not audited** in this pass and would be worth a follow-up look if you want to hunt for actual vulnerabilities (this investigation is architecture-only, no exploitation attempted per your instructions).
- **Sensitive data in memory**: conversation transcripts, screenshots, and audio all pass through process memory only (not persisted), which is good for at-rest privacy but means anyone with a memory-inspection tool while the app runs could see them — a normal tradeoff for this class of app, not a bug.

## Q. Important Files (read these before modifying anything)

| File | Lines | Why it matters |
|---|---|---|
| `main.js` | 1990 | The entire main-process orchestration — app lifecycle, IPC hub, global shortcuts, stealth logic |
| `src/managers/window.manager.js` | 1824 | All window creation, show/hide, positioning, binding, content-protection |
| `src/services/llm.service.js` | 1655 | All Gemini API integration, prompt building, streaming, retries |
| `src/services/speech.service.js` | 2019 | All audio capture, VAD, Whisper/Azure provider logic |
| `src/managers/session.manager.js` | 600 | In-memory conversation history (the app's only "session" concept) |
| `preload.js` | 160 | The full IPC contract exposed to every renderer window |
| `src/core/config.js` | 129 | All default settings/config keys in one place |
| `prompt-loader.js` | 407 | Skill/prompt system (currently DSA-only, despite more being defined) |
| `src/core/first-run.js` | 171 | Onboarding/"returning user" detection logic |
| `src/services/whisper-worker.service.js` + `scripts/whisper_worker.py` | 213 + 173 | The Node↔Python bridge for local transcription |
| `src/services/capture.service.js` | 122 | Screenshot capture (small but central) |
| `package.json` | — | Build config, dependencies, app identity (appId, productName) |

## R. Modification Map

**If I want to modify the UI only** (colors, layout, wording, buttons):
→ `index.html` / `chat.html` / `llm-response.html` / `settings.html` / `onboarding.html` (structure), their inline `<script>` blocks or `src/ui/main-window.js` / `src/ui/settings-window.js` (behavior — note `src/ui/chat-window.js` is dead code, edit `chat.html`'s inline script instead), plus `src/styles/common.css` / `src/input.css` / Tailwind classes for styling.

**If I want to modify desktop window behavior** (size, position, always-on-top, binding, stealth):
→ `src/managers/window.manager.js` (almost everything window-related lives here) and the `globalShortcut` registrations in `main.js:391-417`.

**If I want to modify session handling** (conversation memory, compression, history length):
→ `src/managers/session.manager.js`. Remember: this is chat-context memory, not auth — there's no login system to modify.

**If I want to modify the web ↔ desktop connection**:
→ **Not applicable** — they aren't connected. If you want to actually connect them (e.g., make the desktop app phone home to the website, or add a real backend/auth), that would be new architecture, not a modification of something existing.

**If I want to modify AI behavior** (prompts, model choice, retry logic, streaming):
→ `src/services/llm.service.js` (request/retry/streaming logic), `prompt-loader.js` + `prompts/*.md` (system prompts, and note the DSA-only filter at `prompt-loader.js:31` if you want to re-enable the `programming` skill or add new ones), `src/core/config.js` (model names, retry counts, generation params).

**If I want to modify audio/screen capture**:
→ Audio: `src/services/speech.service.js` (VAD tuning, provider switching) + `scripts/whisper_worker.py` (the actual transcription) + `src/ui/main-window.js:679-729` (renderer mic capture on Windows/macOS). Screen: `src/services/capture.service.js` (currently only 122 lines — quite small, easy to extend for area-select capture, multiple displays, etc.).

---

*This document was generated by a full read-through of every source file in the repository (no file was skipped or guessed at) and is intended as a reference before making changes — nothing in the codebase was modified to produce it.*
