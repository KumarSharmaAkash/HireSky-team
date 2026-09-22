# HireSky — Setup Guide (Windows + Mac)

HireSky ek Electron-based desktop app hai (AI interview copilot). Isko run karne ke liye Node.js chahiye aur kam se kam ek **Gemini API key**.

---

## 1. Zaroori cheezein (Prerequisites)

- **Node.js 18+** — [nodejs.org](https://nodejs.org/) se install karo (LTS version le lena).
- **Git** — repo clone karne ke liye (already kiya hua hai).
- **Gemini API Key** (required) — free milti hai [Google AI Studio](https://aistudio.google.com/) se.
- (Optional) Voice/speech ke liye ek extra key — neeche section 4 me detail hai.

---

## 2. Windows par kaise chalayein

Windows par `setup.sh` (bash script) direct CMD/PowerShell me nahi chalta, isliye **Git Bash** (Git for Windows ke saath aata hai) ya **WSL** use karo.

```bash
git clone https://github.com/Akash/HireSky.git
cd HireSky
./setup.sh
```

Ye script khud:
- Node dependencies install karega (`npm install`)
- `.env` file banayega (`env.example` se copy karke)
- Local Whisper (offline voice) virtual environment set karega
- App ko launch bhi kar dega

Pehli baar app open hote hi **Settings window** automatically khulegi — wahan Gemini API key paste kar dena (ya niche diye gaye `.env` file me directly daal sakte ho).

> Agar sirf setup karna hai, app launch nahi karna to: `./setup.sh --no-run`

**Windows notes:**
- SmartScreen warning aaye to "More info" → "Run anyway" click karo, ya development ke liye `npm start` use karo.
- Pre-built `.exe` installer bhi available hai GitHub Releases page par, agar source se build nahi karna: https://github.com/Akash/HireSky/releases/latest

---

## 3. Mac par kaise chalayein

macOS ke liye pre-built app nahi hai (Gatekeeper block karta hai kyunki app signed/notarized nahi hai), isliye source se run karna hi tarika hai — aur ye **ek command** jitna simple hai.

```bash
cd /Users/akash/Broski/HireSky
chmod +x setup.sh
./setup.sh
```

Same script Mac par bhi sab kuch automatically karega — dependencies, `.env` file, Whisper setup, aur app launch.

Pehli baar Settings window khulegi — Gemini API key wahi paste karo.

**Mac notes:**
- Screen capture kaam na kare to: System Settings → Privacy & Security → Screen Recording me HireSky ko permission do, phir app restart karo.
- Terminal normal use hota hai (Git Bash ki zaroorat nahi, wo sirf Windows ke liye hai).

---

## 4. `.env` file — kaunse API keys chahiye

`setup.sh` khud `.env` bana deta hai (`env.example` se). Bas isme values daalni hain:

```bash
# REQUIRED — bina iske app AI answers nahi de payega
GEMINI_API_KEY=your_gemini_api_key_here
```

**Gemini API key kaise lein (Required, Free):**
1. https://aistudio.google.com/ par jao
2. Google account se sign in karo
3. "Get API key" → "Create API key" click karo
4. Key copy karke `.env` me ya app ki Settings window me paste kar do

### Voice/Speech — Optional (agar chahiye to inme se ek choose karo)

Voice feature bilkul optional hai — agar setup nahi karoge to mic button apne aap hide ho jayega.

**Option A — Local Whisper (free, offline, recommended):**
```bash
SPEECH_PROVIDER=whisper
WHISPER_MODEL=small
```
`setup.sh` khud Whisper install kar deta hai (Python venv ke andar). Koi extra API key nahi chahiye.

**Option B — Azure Speech (cloud, paid/free-tier):**
```bash
SPEECH_PROVIDER=azure
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=your_region
```
Key [Azure Portal](https://portal.azure.com/) se "Speech" resource bana ke milti hai.

---

## 5. Summary — Kya kya chahiye

| Cheez | Zaroori? | Kahan se milegi |
|---|---|---|
| Node.js 18+ | Haan | nodejs.org |
| Gemini API Key | **Haan (required)** | aistudio.google.com — free |
| Azure Speech Key | Nahi (optional, voice ke liye) | portal.azure.com |
| Local Whisper | Nahi (optional, voice ke liye) | `setup.sh` khud install karta hai |

---

## 6. Useful commands

```bash
./setup.sh --build                # Apne OS ke liye distributable build banao
./setup.sh --no-run               # Sirf setup karo, app launch mat karo
./setup.sh --skip-whisper         # Whisper setup skip karo
npm start                         # App directly start karo (setup ke baad)
npm run dev                       # Dev mode me run karo (debugging ke liye)
```

## 7. Keyboard shortcuts (app use karte waqt)

| Action | Shortcut |
|---|---|
| Screenshot capture | `Cmd/Ctrl + Shift + S` |
| Voice toggle | `Alt + R` |
| Show/Hide overlay | `Cmd/Ctrl + Shift + V` |
| Click-through toggle | `Cmd/Ctrl + Shift + I` |
| Open chat | `Cmd/Ctrl + Shift + C` |
| Settings | `Cmd/Ctrl + ,` |
